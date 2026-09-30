import express from 'express';
import http from 'node:http';
import { Server } from 'socket.io';
import cors from 'cors';
import compression from 'compression';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { DatabaseSync } from 'node:sqlite';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = process.env.DATA_DIR || path.resolve(__dirname, '../data');
if (!fs.existsSync(DATA_DIR)) {
  try { fs.mkdirSync(DATA_DIR, { recursive: true }); } catch { /* ignore */ }
}
const DB_FILE = path.join(DATA_DIR, 'users_db.json');
const MAILBOX_FILE = path.join(DATA_DIR, 'offline_mailbox.json');
const SQLITE_FILE = path.join(DATA_DIR, 'chatforge.sqlite');

// Initialize native SQLite Engine (Zero-dependency, ACID compliant, durable across git pushes)
let sqliteDb = null;
try {
  sqliteDb = new DatabaseSync(SQLITE_FILE);
  sqliteDb.exec(`
    PRAGMA journal_mode = WAL;
    CREATE TABLE IF NOT EXISTS users (
      tag TEXT PRIMARY KEY,
      username TEXT NOT NULL,
      password_hash TEXT NOT NULL,
      salt TEXT NOT NULL,
      avatar TEXT,
      custom_status TEXT,
      session_token TEXT,
      contacts_json TEXT,
      settings_json TEXT,
      last_seen TEXT,
      created_at INTEGER
    );
    CREATE TABLE IF NOT EXISTS offline_mailbox (
      id TEXT PRIMARY KEY,
      recipient_tag TEXT NOT NULL,
      sender_tag TEXT NOT NULL,
      message_json TEXT NOT NULL,
      queued_at INTEGER NOT NULL
    );
  `);
  console.log(`[DATABASE] SQLite engine initialized at ${SQLITE_FILE}`);
} catch (err) {
  console.warn('[DATABASE] SQLite initialization failed, falling back to JSON storage:', err.message);
}

const app = express();
const port = Number(process.env.PORT) || 3001;

app.disable('x-powered-by');
app.set('trust proxy', process.env.TRUST_PROXY === '1');
app.use(cors({ origin: true, credentials: true }));
app.use(compression());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Security Headers
app.use((req, res, next) => {
  res.set('X-Content-Type-Options', 'nosniff');
  res.set('X-Frame-Options', 'DENY');
  res.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  if (process.env.NODE_ENV === 'production') {
    if (req.secure) res.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
    res.set('Content-Security-Policy', [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      "font-src 'self' https://fonts.gstatic.com data:",
      "img-src 'self' data: blob: https://images.unsplash.com https://api.dicebear.com",
      "media-src 'self' data: blob:",
      "connect-src 'self' ws: wss: *",
      "worker-src 'self' blob:",
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "form-action 'self'",
    ].join('; '));
  }
  next();
});

const server = http.createServer(app);
const io = new Server(server, {
  maxHttpBufferSize: 5e7, // 50MB for media/voice note payloads
  cors: {
    origin: (origin, callback) => callback(null, true),
    methods: ['GET', 'POST'],
    credentials: true,
  },
});

// In-Memory Storage & Persistence
// registeredUsers: tag (e.g. '@neo') -> { username, tag, passwordHash, salt, avatar, customStatus, socketId, status, lastSeen, sessionToken, contacts, settings }
const registeredUsers = new Map();
// offlineMailbox: recipientTag -> [ { message, senderTag, queuedAt } ]
const offlineMailbox = new Map();

function hashPassword(password, salt) {
  return crypto.scryptSync(password, salt, 64).toString('hex');
}

function verifyPassword(password, user) {
  if (user.salt) {
    const hash = hashPassword(password, user.salt);
    return crypto.timingSafeEqual(Buffer.from(hash, 'hex'), Buffer.from(user.passwordHash, 'hex'));
  }
  // Legacy SHA-256 fallback
  const legacyHash = crypto.createHash('sha256').update(password + 'chatforge_quantum_salt_v1').digest('hex');
  if (legacyHash === user.passwordHash) {
    // Upgrade to scrypt
    user.salt = crypto.randomBytes(16).toString('hex');
    user.passwordHash = hashPassword(password, user.salt);
    saveUser(user);
    return true;
  }
  return false;
}

function loadDatabase() {
  // 1. Load users from SQLite if available
  if (sqliteDb) {
    try {
      const rows = sqliteDb.prepare('SELECT * FROM users').all();
      rows.forEach((row) => {
        let contacts = [];
        let settings = null;
        try { if (row.contacts_json) contacts = JSON.parse(row.contacts_json); } catch { /* ignore */ }
        try { if (row.settings_json) settings = JSON.parse(row.settings_json); } catch { /* ignore */ }

        registeredUsers.set(row.tag.toLowerCase(), {
          username: row.username,
          tag: row.tag,
          passwordHash: row.password_hash,
          salt: row.salt,
          avatar: row.avatar,
          customStatus: row.custom_status || 'Active Node',
          sessionToken: row.session_token || null,
          contacts,
          settings,
          lastSeen: row.last_seen || 'offline',
          status: 'offline',
          socketId: null,
        });
      });
      console.log(`[DATABASE] Loaded ${registeredUsers.size} user account(s) from SQLite`);

      // Load offline mailbox from SQLite
      const mailboxRows = sqliteDb.prepare('SELECT * FROM offline_mailbox ORDER BY queued_at ASC').all();
      mailboxRows.forEach((row) => {
        try {
          const msgObj = JSON.parse(row.message_json);
          const rTag = row.recipient_tag.toLowerCase();
          if (!offlineMailbox.has(rTag)) offlineMailbox.set(rTag, []);
          offlineMailbox.get(rTag).push(msgObj);
        } catch { /* ignore */ }
      });
      console.log(`[DATABASE] Loaded offline mailboxes from SQLite`);
    } catch (err) {
      console.error('[DATABASE] Error reading SQLite:', err);
    }
  }

  // 2. Migration / Fallback from users_db.json
  try {
    const legacyDbFile = path.join(__dirname, 'users_db.json');
    if (!fs.existsSync(DB_FILE) && fs.existsSync(legacyDbFile)) {
      try {
        fs.copyFileSync(legacyDbFile, DB_FILE);
        console.log(`[DATABASE] Migrated existing users DB to ${DB_FILE}`);
      } catch { /* ignore */ }
    }
    if (fs.existsSync(DB_FILE)) {
      const data = JSON.parse(fs.readFileSync(DB_FILE, 'utf8') || '{}');
      let importedCount = 0;
      Object.entries(data).forEach(([tag, user]) => {
        const lowerTag = tag.toLowerCase();
        if (!registeredUsers.has(lowerTag)) {
          const newUserObj = {
            ...user,
            status: 'offline',
            socketId: null,
            contacts: user.contacts || [],
            settings: user.settings || null,
          };
          registeredUsers.set(lowerTag, newUserObj);
          if (sqliteDb) {
            try {
              const stmt = sqliteDb.prepare(`
                INSERT OR REPLACE INTO users (
                  tag, username, password_hash, salt, avatar, custom_status, session_token, contacts_json, settings_json, last_seen, created_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
              `);
              stmt.run(
                newUserObj.tag,
                newUserObj.username,
                newUserObj.passwordHash,
                newUserObj.salt,
                newUserObj.avatar || '',
                newUserObj.customStatus || 'Active Node',
                newUserObj.sessionToken || '',
                JSON.stringify(newUserObj.contacts || []),
                JSON.stringify(newUserObj.settings || null),
                newUserObj.lastSeen || 'offline',
                Date.now()
              );
            } catch { /* ignore */ }
          }
          importedCount++;
        }
      });
      if (importedCount > 0) {
        console.log(`[DATABASE] Imported ${importedCount} additional user account(s) from JSON`);
      }
    }
  } catch (err) {
    console.error('[DATABASE] Error reading users_db.json:', err);
  }

  // 3. Fallback from offline_mailbox.json
  try {
    const legacyMailboxFile = path.join(__dirname, 'offline_mailbox.json');
    if (!fs.existsSync(MAILBOX_FILE) && fs.existsSync(legacyMailboxFile)) {
      try {
        fs.copyFileSync(legacyMailboxFile, MAILBOX_FILE);
      } catch { /* ignore */ }
    }
    if (fs.existsSync(MAILBOX_FILE)) {
      const data = JSON.parse(fs.readFileSync(MAILBOX_FILE, 'utf8') || '{}');
      Object.entries(data).forEach(([tag, msgs]) => {
        const lowerTag = tag.toLowerCase();
        if (!offlineMailbox.has(lowerTag) && Array.isArray(msgs) && msgs.length > 0) {
          offlineMailbox.set(lowerTag, msgs);
        }
      });
    }
  } catch (err) {
    console.error('[DATABASE] Error reading offline_mailbox.json:', err);
  }
}

function saveUser(user) {
  if (!user?.tag) return;
  const tag = user.tag.toLowerCase();
  registeredUsers.set(tag, user);

  // Write to SQLite
  if (sqliteDb) {
    try {
      const stmt = sqliteDb.prepare(`
        INSERT OR REPLACE INTO users (
          tag, username, password_hash, salt, avatar, custom_status, session_token, contacts_json, settings_json, last_seen, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      stmt.run(
        user.tag,
        user.username,
        user.passwordHash,
        user.salt,
        user.avatar || '',
        user.customStatus || '',
        user.sessionToken || '',
        JSON.stringify(user.contacts || []),
        JSON.stringify(user.settings || null),
        user.lastSeen || 'offline',
        Date.now()
      );
    } catch (err) {
      console.error('[DATABASE] Error writing user to SQLite:', err);
    }
  }

  // Mirror to users_db.json
  saveUserDatabaseFile();
}

function saveUserDatabaseFile() {
  try {
    const obj = {};
    registeredUsers.forEach((user, tag) => {
      obj[tag] = {
        username: user.username,
        tag: user.tag,
        passwordHash: user.passwordHash,
        salt: user.salt,
        avatar: user.avatar,
        customStatus: user.customStatus,
        lastSeen: user.lastSeen,
        sessionToken: user.sessionToken || null,
        contacts: user.contacts || [],
        settings: user.settings || null,
      };
    });
    fs.writeFileSync(DB_FILE, JSON.stringify(obj, null, 2), 'utf8');
  } catch (err) {
    console.error('[DATABASE] Error saving users_db.json:', err);
  }
}

function saveUserDatabase() {
  registeredUsers.forEach((user) => {
    saveUser(user);
  });
}

function saveOfflineMailbox() {
  // Save to SQLite
  if (sqliteDb) {
    try {
      sqliteDb.exec('DELETE FROM offline_mailbox');
      const insert = sqliteDb.prepare(`
        INSERT INTO offline_mailbox (id, recipient_tag, sender_tag, message_json, queued_at)
        VALUES (?, ?, ?, ?, ?)
      `);
      offlineMailbox.forEach((msgs, recipientTag) => {
        if (Array.isArray(msgs)) {
          msgs.forEach((item) => {
            const msgId = item.message?.id || `mb_${Date.now()}_${Math.random()}`;
            insert.run(
              msgId,
              recipientTag.toLowerCase(),
              item.senderTag || '',
              JSON.stringify(item),
              item.queuedAt || Date.now()
            );
          });
        }
      });
    } catch (err) {
      console.error('[DATABASE] Error saving mailbox to SQLite:', err);
    }
  }

  // Mirror to JSON
  try {
    const obj = {};
    offlineMailbox.forEach((msgs, tag) => {
      if (msgs && msgs.length > 0) {
        obj[tag] = msgs;
      }
    });
    fs.writeFileSync(MAILBOX_FILE, JSON.stringify(obj, null, 2), 'utf8');
  } catch (err) {
    console.error('[DATABASE] Error saving offline_mailbox.json:', err);
  }
}

loadDatabase();

function getPublicPeerList() {
  const peers = [];
  registeredUsers.forEach((user) => {
    peers.push({
      id: `peer_${user.username.toLowerCase()}`,
      username: user.username,
      tag: user.tag,
      avatar: user.avatar,
      status: user.status || 'offline',
      lastSeen: user.lastSeen || 'offline',
      customStatus: user.customStatus || 'Active Node',
    });
  });
  return peers;
}

// Socket.io Real-time Relay
io.on('connection', (socket) => {
  let authenticatedUser = null;

  // Authentication & Registration
  socket.on('authenticate_user', (data, callback) => {
    const { username, password, avatar, isRegisterMode } = data || {};
    const cleanUser = String(username || '').trim().replace(/^@/, '');
    const tag = `@${cleanUser.toLowerCase()}`;

    if (!cleanUser || cleanUser.length < 2 || cleanUser.length > 32) {
      return callback?.({ success: false, error: 'Username must be 2 to 32 characters.' });
    }
    if (!/^[a-zA-Z0-9_.-]+$/.test(cleanUser)) {
      return callback?.({ success: false, error: 'Username can only contain letters, numbers, dots, dashes, and underscores.' });
    }
    if (!password || password.length < 4) {
      return callback?.({ success: false, error: 'Password must be at least 4 characters.' });
    }

    if (isRegisterMode) {
      if (registeredUsers.has(tag)) {
        return callback?.({ success: false, error: 'That username is already taken. Please choose another or sign in.' });
      }

      const salt = crypto.randomBytes(16).toString('hex');
      const passwordHash = hashPassword(password, salt);
      const sessionToken = crypto.randomBytes(32).toString('hex');

      const newUser = {
        username: cleanUser,
        tag,
        passwordHash,
        salt,
        avatar: avatar || 'https://api.dicebear.com/9.x/bottts/svg?seed=Circuit',
        customStatus: 'Connected to Relay',
        status: 'online',
        socketId: socket.id,
        sessionToken,
        lastSeen: 'online',
      };

      registeredUsers.set(tag, newUser);
      saveUserDatabase();
      authenticatedUser = newUser;

      console.log(`[AUTH] Registered new user: ${tag}`);
      callback?.({
        success: true,
        peerInfo: {
          username: newUser.username,
          tag: newUser.tag,
          avatar: newUser.avatar,
          customStatus: newUser.customStatus,
          status: 'online',
        },
        sessionToken,
      });

      io.emit('peers_update', getPublicPeerList());
      return;
    }

    // Sign in mode
    const existingUser = registeredUsers.get(tag);
    if (!existingUser) {
      return callback?.({ success: false, error: 'No account found with that username. Choose "Create account" to register.' });
    }

    if (!verifyPassword(password, existingUser)) {
      return callback?.({ success: false, error: 'Incorrect password. Please try again.' });
    }

    const oldSocketId = existingUser.socketId;
    const newSessionToken = crypto.randomBytes(32).toString('hex');
    existingUser.status = 'online';
    existingUser.socketId = socket.id;
    existingUser.lastSeen = 'online';
    if (avatar) existingUser.avatar = avatar;
    existingUser.sessionToken = newSessionToken;
    authenticatedUser = existingUser;
    saveUser(existingUser);

    // Single Active Device Kickout: Disconnect any older active session
    if (oldSocketId && oldSocketId !== socket.id) {
      console.log(`[AUTH] Kicking old session for ${tag} (socket ${oldSocketId})`);
      io.to(oldSocketId).emit('force_logout', {
        reason: 'Logged in from another device or browser tab.',
      });
      const oldSocket = io.sockets.sockets.get(oldSocketId);
      if (oldSocket) {
        oldSocket.disconnect(true);
      }
    }

    console.log(`[AUTH] Authenticated user: ${tag}`);
    callback?.({
      success: true,
      peerInfo: {
        username: existingUser.username,
        tag: existingUser.tag,
        avatar: existingUser.avatar,
        customStatus: existingUser.customStatus,
        status: 'online',
      },
      sessionToken: newSessionToken,
      contacts: existingUser.contacts || [],
      settings: existingUser.settings || null,
    });

    // Notify all clients of updated online status
    io.emit('peers_update', getPublicPeerList());

    // Flush any pending offline mailbox messages for this user
    const pendingMessages = offlineMailbox.get(tag) || [];
    if (pendingMessages.length > 0) {
      console.log(`[MAILBOX] Flushing ${pendingMessages.length} offline item(s) to ${tag}`);
      pendingMessages.forEach((item) => {
        if (item.type === 'disappearing_timer_sync') {
          socket.emit('disappearing_timer_sync', {
            senderTag: item.senderTag,
            seconds: item.seconds,
            isTwoWay: item.isTwoWay,
          });
        } else {
          socket.emit('receive_message', {
            message: item.message,
            senderTag: item.senderTag,
            senderInfo: item.senderInfo,
          });
        }
      });
      offlineMailbox.delete(tag);
      saveOfflineMailbox();
    }
  });

  // Reconnect with active session token
  socket.on('resume_session', (profile, callback) => {
    if (!profile?.tag) return callback?.({ success: false, error: 'Tag required' });
    const tag = profile.tag.toLowerCase();
    const existing = registeredUsers.get(tag);
    if (!existing) {
      return callback?.({ success: false, error: 'User not registered' });
    }

    // Session Token Validation for Single-Session Enforcement
    if (profile.sessionToken && existing.sessionToken && profile.sessionToken !== existing.sessionToken) {
      console.log(`[AUTH] Stale session token for ${tag} - emitting force_logout`);
      socket.emit('force_logout', {
        reason: 'Session expired. You were logged into this account on another device.',
      });
      return callback?.({ success: false, error: 'Session expired' });
    }

    const oldSocketId = existing.socketId;
    existing.status = 'online';
    existing.socketId = socket.id;
    existing.lastSeen = 'online';
    if (profile.sessionToken) {
      existing.sessionToken = profile.sessionToken;
    }
    authenticatedUser = existing;
    saveUser(existing);

    if (oldSocketId && oldSocketId !== socket.id) {
      io.to(oldSocketId).emit('force_logout', {
        reason: 'Logged in from another device or browser tab.',
      });
      const oldSocket = io.sockets.sockets.get(oldSocketId);
      if (oldSocket) {
        oldSocket.disconnect(true);
      }
    }

    callback?.({
      success: true,
      contacts: existing.contacts || [],
      settings: existing.settings || null,
    });
    io.emit('peers_update', getPublicPeerList());

    // Flush offline messages
    const pendingMessages = offlineMailbox.get(tag) || [];
    if (pendingMessages.length > 0) {
      pendingMessages.forEach((item) => {
        if (item.type === 'disappearing_timer_sync') {
          socket.emit('disappearing_timer_sync', {
            senderTag: item.senderTag,
            seconds: item.seconds,
            isTwoWay: item.isTwoWay,
          });
        } else {
          socket.emit('receive_message', {
            message: item.message,
            senderTag: item.senderTag,
            senderInfo: item.senderInfo,
          });
        }
      });
      offlineMailbox.delete(tag);
      saveOfflineMailbox();
    }
  });

  // Send / Relay Message
  socket.on('send_message', (payload, callback) => {
    const { recipientTag, message } = payload || {};
    if (!recipientTag || !message) return callback?.({ success: false, error: 'Invalid message payload' });

    const cleanRecipientTag = recipientTag.toLowerCase();
    const recipient = registeredUsers.get(cleanRecipientTag);
    const senderTag = authenticatedUser?.tag || message.senderTag || '@anonymous';
    const senderUser = registeredUsers.get(senderTag.toLowerCase());

    const senderInfo = {
      tag: senderTag,
      username: senderUser?.username || senderTag.replace(/^@/, ''),
      avatar: senderUser?.avatar || message.senderAvatar,
    };

    if (recipient && recipient.socketId && recipient.status === 'online') {
      // Deliver in real-time
      io.to(recipient.socketId).emit('receive_message', {
        message,
        senderTag,
        senderInfo,
      });

      // Confirm delivery to sender
      callback?.({ success: true, status: 'delivered' });
      socket.emit('message_status_update', { messageId: message.id, status: 'delivered' });
    } else {
      // Store in Offline Mailbox
      if (!offlineMailbox.has(cleanRecipientTag)) {
        offlineMailbox.set(cleanRecipientTag, []);
      }
      offlineMailbox.get(cleanRecipientTag).push({
        message,
        senderTag,
        senderInfo,
        queuedAt: Date.now(),
      });
      saveOfflineMailbox();

      console.log(`[MAILBOX] Queued message ${message.id} for offline user ${cleanRecipientTag}`);
      callback?.({ success: true, status: 'queued' });
      socket.emit('message_status_update', { messageId: message.id, status: 'queued' });
    }
  });

  // Search User Directory
  socket.on('search_users', (query, callback) => {
    const q = String(query || '').trim().toLowerCase().replace(/^@/, '');
    if (!q) return callback?.([]);

    const matches = [];
    registeredUsers.forEach((user) => {
      if (user.tag.toLowerCase() === authenticatedUser?.tag?.toLowerCase()) return;
      if (user.username.toLowerCase().includes(q) || user.tag.toLowerCase().includes(q)) {
        matches.push({
          id: `peer_${user.username.toLowerCase()}`,
          username: user.username,
          tag: user.tag,
          avatar: user.avatar,
          status: user.status || 'offline',
          lastSeen: user.lastSeen || 'offline',
          customStatus: user.customStatus || 'Registered Node',
        });
      }
    });

    callback?.(matches.slice(0, 25));
  });

  // Typing Indicator
  socket.on('typing', ({ recipientTag, isTyping }) => {
    if (!recipientTag || !authenticatedUser) return;
    const recipient = registeredUsers.get(recipientTag.toLowerCase());
    if (recipient?.socketId) {
      io.to(recipient.socketId).emit('typing', {
        senderTag: authenticatedUser.tag,
        isTyping: Boolean(isTyping),
      });
    }
  });

  // Read Receipt
  socket.on('message_read', ({ messageId, recipientTag }) => {
    if (!recipientTag) return;
    const sender = registeredUsers.get(recipientTag.toLowerCase());
    if (sender?.socketId) {
      io.to(sender.socketId).emit('message_status_update', {
        messageId,
        status: 'read',
      });
    }
  });

  // Delivery Receipt
  socket.on('message_delivered', ({ messageId, recipientTag }) => {
    if (!recipientTag) return;
    const sender = registeredUsers.get(recipientTag.toLowerCase());
    if (sender?.socketId) {
      io.to(sender.socketId).emit('message_status_update', {
        messageId,
        status: 'delivered',
      });
    }
  });

  // Message Reaction
  socket.on('message_reaction', ({ messageId, recipientTag, emoji }) => {
    if (!recipientTag) return;
    const recipient = registeredUsers.get(recipientTag.toLowerCase());
    if (recipient?.socketId) {
      io.to(recipient.socketId).emit('message_reaction', {
        messageId,
        emoji,
      });
    }
  });

  // Message Delete (for everyone)
  socket.on('delete_message', ({ messageId, recipientTag }) => {
    if (!recipientTag) return;
    const recipient = registeredUsers.get(recipientTag.toLowerCase());
    if (recipient?.socketId) {
      io.to(recipient.socketId).emit('message_deleted', { messageId });
    }
  });

  // Message Shred (burn after reading / auto-delete)
  socket.on('message_shredded', ({ messageId, recipientTag }) => {
    if (!messageId) return;
    if (recipientTag) {
      const recipient = registeredUsers.get(recipientTag.toLowerCase());
      if (recipient?.socketId) {
        io.to(recipient.socketId).emit('message_shredded', { messageId });
      }
      // Purge from offline mailbox if pending
      const queued = offlineMailbox.get(recipientTag.toLowerCase());
      if (queued && queued.length > 0) {
        const filtered = queued.filter((item) => item.message?.id !== messageId);
        if (filtered.length !== queued.length) {
          offlineMailbox.set(recipientTag.toLowerCase(), filtered);
          saveOfflineMailbox();
        }
      }
    }
  });

  // Ephemeral Disappearing Timer Sync (Two-Way or Peer Notification)
  socket.on('set_disappearing_timer', (payload) => {
    const { recipientTag, seconds, isTwoWay } = payload || {};
    if (!recipientTag) return;
    const cleanRecipientTag = recipientTag.toLowerCase();
    const recipient = registeredUsers.get(cleanRecipientTag);
    const senderTag = authenticatedUser?.tag || socket.userTag || '@anonymous';

    if (recipient?.socketId) {
      io.to(recipient.socketId).emit('disappearing_timer_sync', {
        senderTag,
        seconds: Number(seconds) || 0,
        isTwoWay: !!isTwoWay,
      });
    } else {
      if (!offlineMailbox.has(cleanRecipientTag)) {
        offlineMailbox.set(cleanRecipientTag, []);
      }
      offlineMailbox.get(cleanRecipientTag).push({
        type: 'disappearing_timer_sync',
        senderTag,
        seconds: Number(seconds) || 0,
        isTwoWay: !!isTwoWay,
        queuedAt: new Date().toISOString(),
      });
      saveOfflineMailbox();
    }
  });

  // Cross-device account sync (contacts & settings)
  socket.on('sync_account_state', (data) => {
    if (!authenticatedUser) return;
    const { contacts, settings } = data || {};
    let changed = false;
    if (contacts && Array.isArray(contacts)) {
      authenticatedUser.contacts = contacts;
      changed = true;
    }
    if (settings && typeof settings === 'object') {
      authenticatedUser.settings = settings;
      changed = true;
    }
    if (changed) {
      saveUser(authenticatedUser);
    }
  });

  // Explicit session logout
  socket.on('logout_session', () => {
    if (authenticatedUser) {
      authenticatedUser.status = 'offline';
      authenticatedUser.socketId = null;
      authenticatedUser.sessionToken = null;
      authenticatedUser.lastSeen = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      saveUser(authenticatedUser);
      authenticatedUser = null;
      io.emit('peers_update', getPublicPeerList());
    }
  });

  // Update Profile / Status
  socket.on('update_profile', (updates, callback) => {
    if (!authenticatedUser) return callback?.({ success: false, error: 'Not authenticated' });
    if (updates?.avatar) authenticatedUser.avatar = updates.avatar;
    if (updates?.customStatus) authenticatedUser.customStatus = updates.customStatus;
    saveUser(authenticatedUser);
    callback?.({ success: true });
    io.emit('peers_update', getPublicPeerList());
  });

  // Disconnect
  socket.on('disconnect', () => {
    if (authenticatedUser && authenticatedUser.socketId === socket.id) {
      authenticatedUser.status = 'offline';
      authenticatedUser.socketId = null;
      authenticatedUser.lastSeen = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      saveUser(authenticatedUser);
      console.log(`[DISCONNECT] ${authenticatedUser.tag} went offline`);
      io.emit('peers_update', getPublicPeerList());
    }
  });
});

// REST Health and Info Endpoints
app.get('/healthz', (_req, res) => res.status(200).send('OK'));
app.get('/api/health', (_req, res) => res.status(200).json({ status: 'ok', uptime: process.uptime() }));

app.get('/api/info', (_req, res) => {
  let onlineCount = 0;
  registeredUsers.forEach((u) => {
    if (u.status === 'online') onlineCount++;
  });
  res.json({
    status: 'online',
    relay: 'Chatforge Standalone Relay',
    usersOnline: onlineCount,
    totalRegistered: registeredUsers.size,
    port,
  });
});

// Production SPA Static File Serving
const distPath = path.resolve(__dirname, '../dist');
app.use(express.static(distPath, {
  index: false,
  setHeaders: (res, filePath) => {
    if (filePath.includes(`${path.sep}assets${path.sep}`)) {
      res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    } else {
      res.setHeader('Cache-Control', process.env.NODE_ENV === 'production' ? 'public, max-age=3600' : 'no-cache');
    }
  },
}));

app.get('*path', (req, res) => {
  if (req.path.startsWith('/api/')) return res.status(404).json({ error: 'API route not found.' });
  res.set('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.sendFile(path.join(distPath, 'index.html'), (error) => {
    if (error && !res.headersSent) res.status(503).send('Frontend build is missing. Run npm run build first.');
  });
});

function startServer(targetPort, retries = 5) {
  server.removeAllListeners('error');
  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      if (retries > 0) {
        console.warn(`[CHATFORGE RELAY] Port ${targetPort} is occupied, retrying in 1s... (${retries} retries left)`);
        setTimeout(() => {
          try { server.close(); } catch { /* ignore */ }
          startServer(targetPort, retries - 1);
        }, 1000);
      } else {
        console.error(`[CHATFORGE RELAY] FATAL: Port ${targetPort} is already in use by another process.`);
        process.exit(1);
      }
    } else {
      console.error('[CHATFORGE RELAY] Server error:', err);
    }
  });

  server.listen(targetPort, '0.0.0.0', () => {
    console.log(`===============================================`);
    console.log(`[CHATFORGE RELAY] Listening on port ${targetPort}`);
    console.log(`[STATUS] Standalone Socket.IO Relay Active`);
    console.log(`===============================================`);
  });
}

startServer(port);

const shutdown = (signal) => {
  console.log(`[CHATFORGE RELAY] Received ${signal}, closing server...`);
  server.close(() => {
    console.log('[CHATFORGE RELAY] Server closed gracefully.');
    process.exit(0);
  });
  setTimeout(() => process.exit(1), 10000).unref();
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
