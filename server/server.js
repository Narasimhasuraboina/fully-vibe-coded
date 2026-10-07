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
try { fs.chmodSync(DATA_DIR, 0o700); } catch { /* permissions may be managed by the deployment */ }
const DB_FILE = path.join(DATA_DIR, 'users_db.json');
const MAILBOX_FILE = path.join(DATA_DIR, 'offline_mailbox.json');
const SQLITE_FILE = path.join(DATA_DIR, 'chatforge.sqlite');
const allowedOrigins = new Set(
  (process.env.ALLOWED_ORIGINS || 'http://localhost:5173,http://127.0.0.1:5173')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean)
);

function allowConfiguredOrigin(origin, callback) {
  if (!origin || allowedOrigins.has(origin)) return callback(null, true);
  return callback(new Error('Origin is not allowed.'));
}

// Initialize native SQLite Engine (Zero-dependency, ACID compliant, durable across git pushes)
let sqliteDb = null;
try {
  sqliteDb = new DatabaseSync(SQLITE_FILE);
  try { fs.chmodSync(SQLITE_FILE, 0o600); } catch { /* permissions may be managed by the deployment */ }
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
    CREATE TABLE IF NOT EXISTS message_routes (
      id TEXT PRIMARY KEY,
      sender_tag TEXT NOT NULL,
      recipient_tag TEXT NOT NULL,
      created_at INTEGER NOT NULL
    );
  `);
  console.log(`[DATABASE] SQLite engine initialized at ${SQLITE_FILE}`);
} catch (err) {
  console.warn('[DATABASE] SQLite initialization failed, falling back to JSON storage:', err.message);
}

const app = express();
const port = Number(process.env.PORT) || 3001;

app.disable('x-powered-by');
const trustProxyHops = Number.parseInt(process.env.TRUST_PROXY || '', 10);
app.set('trust proxy', Number.isInteger(trustProxyHops) && trustProxyHops > 0 ? trustProxyHops : false);
app.use(cors({ origin: allowConfiguredOrigin, credentials: true }));
app.use(compression());
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ limit: '1mb', extended: true }));

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
      "script-src 'self'",
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      "font-src 'self' https://fonts.gstatic.com data:",
      "img-src 'self' data: blob: https://images.unsplash.com https://api.dicebear.com",
      "media-src 'self' data: blob:",
      "connect-src 'self' ws: wss:",
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
  maxHttpBufferSize: 30 * 1024 * 1024,
  cors: {
    origin: allowConfiguredOrigin,
    methods: ['GET', 'POST'],
    credentials: true,
  },
});

// In-Memory Storage & Persistence
// registeredUsers: tag (e.g. '@neo') -> { username, tag, passwordHash, salt, avatar, customStatus, socketId, status, lastSeen, sessionToken, contacts, settings }
const registeredUsers = new Map();
// offlineMailbox: recipientTag -> [ { message, senderTag, queuedAt } ]
const offlineMailbox = new Map();
const messageRoutes = new Map();
const failedAuthAttempts = new Map();
const registrationAttempts = new Map();
const accountMessageRates = new Map();
const AUTH_WINDOW_MS = 15 * 60 * 1000;
const MAX_AUTH_FAILURES = 10;
const MAX_MESSAGE_BYTES = 28 * 1024 * 1024;
const MAX_MAILBOX_MESSAGES = 100;

function takeWindowedLimit(map, key, limit, windowMs) {
  const now = Date.now();
  let record = map.get(key);
  if (!record || now - record.startedAt >= windowMs) {
    if (map.size >= 10000) {
      for (const [oldKey, oldRecord] of map) {
        if (now - oldRecord.startedAt >= windowMs) map.delete(oldKey);
      }
      while (map.size >= 10000) map.delete(map.keys().next().value);
    }
    record = { startedAt: now, count: 0 };
    map.set(key, record);
  }
  if (record.count >= limit) return false;
  record.count++;
  return true;
}

function isValidTag(tag) {
  return typeof tag === 'string' && /^@[a-z0-9_.-]{2,32}$/i.test(tag);
}

function objectPayload(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function sanitizeAvatar(value, fallback = 'https://api.dicebear.com/9.x/bottts/svg?seed=Circuit') {
  if (typeof value !== 'string' || value.length > 2048) return fallback;
  try {
    const parsed = new URL(value);
    return parsed.protocol === 'https:' ? parsed.href : fallback;
  } catch {
    return fallback;
  }
}

function sanitizeContacts(contacts) {
  if (!Array.isArray(contacts)) return [];
  return contacts.slice(0, 1000).flatMap((contact) => {
    if (!contact || typeof contact !== 'object' || !isValidTag(contact.tag)) return [];
    const tag = contact.tag.toLowerCase();
    return [{
      id: typeof contact.id === 'string' && contact.id.length <= 128 ? contact.id : `contact_${tag}`,
      tag,
      name: typeof contact.name === 'string' ? contact.name.slice(0, 64) : tag.slice(1),
      avatar: sanitizeAvatar(contact.avatar),
      status: contact.status === 'online' ? 'online' : 'offline',
      lastSeen: typeof contact.lastSeen === 'string' ? contact.lastSeen.slice(0, 64) : 'offline',
      unreadCount: Number.isInteger(contact.unreadCount) ? Math.max(0, Math.min(1000000, contact.unreadCount)) : 0,
      disappearingTimer: Number.isFinite(contact.disappearingTimer) ? Math.max(0, Math.min(604800, contact.disappearingTimer)) : 0,
      pinned: Boolean(contact.pinned),
      isSecret: Boolean(contact.isSecret),
      isTwoWayDisappearing: Boolean(contact.isTwoWayDisappearing),
    }];
  });
}

function sanitizeSettings(settings) {
  if (!settings || typeof settings !== 'object' || Array.isArray(settings)) return null;
  return {
    soundEffects: Boolean(settings.soundEffects),
    hideBlueTicks: Boolean(settings.hideBlueTicks),
    theme: typeof settings.theme === 'string' && /^[a-z0-9_-]{1,32}$/i.test(settings.theme) ? settings.theme : 'matrix',
  };
}

function getAuthAttemptKey(socket) {
  return socket.handshake.address || 'unknown';
}

function checkAuthRateLimit(socket) {
  const key = getAuthAttemptKey(socket);
  const now = Date.now();
  const record = failedAuthAttempts.get(key);
  if (!record || now - record.startedAt >= AUTH_WINDOW_MS) {
    if (failedAuthAttempts.size >= 10000) {
      for (const [attemptKey, attempt] of failedAuthAttempts) {
        if (now - attempt.startedAt >= AUTH_WINDOW_MS) failedAuthAttempts.delete(attemptKey);
      }
      while (failedAuthAttempts.size >= 10000) {
        failedAuthAttempts.delete(failedAuthAttempts.keys().next().value);
      }
    }
    failedAuthAttempts.set(key, { startedAt: now, failures: 0 });
    return true;
  }
  return record.failures < MAX_AUTH_FAILURES;
}

function recordAuthFailure(socket) {
  const key = getAuthAttemptKey(socket);
  const now = Date.now();
  const record = failedAuthAttempts.get(key);
  if (!record || now - record.startedAt >= AUTH_WINDOW_MS) {
    failedAuthAttempts.set(key, { startedAt: now, failures: 1 });
  } else {
    record.failures++;
  }
}

function rememberMessageRoute(messageId, senderTag, recipientTag) {
  const createdAt = Date.now();
  messageRoutes.set(messageId, { senderTag, recipientTag, createdAt });
  if (sqliteDb) {
    try {
      sqliteDb.prepare('INSERT OR REPLACE INTO message_routes (id, sender_tag, recipient_tag, created_at) VALUES (?, ?, ?, ?)')
        .run(messageId, senderTag, recipientTag, createdAt);
    } catch (error) {
      console.error('[DATABASE] Error saving message route:', error.message);
    }
  }
  if (messageRoutes.size > 50000) {
    const oldestKey = messageRoutes.keys().next().value;
    messageRoutes.delete(oldestKey);
    if (sqliteDb) {
      try { sqliteDb.prepare('DELETE FROM message_routes WHERE id = ?').run(oldestKey); } catch { /* best-effort route cleanup */ }
    }
  }
}

function isMessageRoute(messageId, senderTag, recipientTag) {
  const route = messageRoutes.get(messageId);
  return Boolean(route && route.senderTag === senderTag && route.recipientTag === recipientTag);
}

function isMessageBetween(messageId, firstTag, secondTag) {
  return isMessageRoute(messageId, firstTag, secondTag) || isMessageRoute(messageId, secondTag, firstTag);
}

function sendMailboxItem(socketId, recipientTag, item) {
  const eventName = item.type === 'disappearing_timer_sync' ? 'disappearing_timer_sync' : 'receive_message';
  const payload = eventName === 'disappearing_timer_sync'
    ? { senderTag: item.senderTag, seconds: item.seconds, isTwoWay: item.isTwoWay }
    : { message: item.message, senderTag: item.senderTag, senderInfo: item.senderInfo };

  io.to(socketId).timeout(10000).emit(eventName, payload, (error, acknowledgement) => {
    const received = Array.isArray(acknowledgement) ? acknowledgement[0] : acknowledgement;
    if (error || received?.received !== true) return;
    const currentQueue = offlineMailbox.get(recipientTag) || [];
    const itemIndex = currentQueue.indexOf(item);
    if (itemIndex === -1) return;
    currentQueue.splice(itemIndex, 1);
    if (currentQueue.length === 0) offlineMailbox.delete(recipientTag);
    else offlineMailbox.set(recipientTag, currentQueue);
    saveOfflineMailbox();

    if (item.message?.id) {
      const sender = registeredUsers.get(item.senderTag?.toLowerCase());
      if (sender?.socketId && io.sockets.sockets.has(sender.socketId)) {
        io.to(sender.socketId).emit('message_status_update', { messageId: item.message.id, status: 'delivered' });
      }
    }
  });
}

function flushOfflineMailbox(socketId, recipientTag) {
  const items = [...(offlineMailbox.get(recipientTag) || [])];
  items.forEach((item) => sendMailboxItem(socketId, recipientTag, item));
}

function hashPassword(password, salt) {
  return crypto.scryptSync(password, salt, 64).toString('hex');
}

function verifyPassword(password, user) {
  if (user.salt) {
    try {
      const hash = Buffer.from(hashPassword(password, user.salt), 'hex');
      const expectedHash = Buffer.from(user.passwordHash || '', 'hex');
      return hash.length === expectedHash.length && crypto.timingSafeEqual(hash, expectedHash);
    } catch {
      return false;
    }
  }
  // Legacy SHA-256 fallback
  const legacyHash = crypto.createHash('sha256').update(password + 'chatforge_quantum_salt_v1').digest('hex');
  const legacyBuffer = Buffer.from(legacyHash, 'hex');
  const storedLegacyHash = Buffer.from(user.passwordHash || '', 'hex');
  if (legacyBuffer.length === storedLegacyHash.length && crypto.timingSafeEqual(legacyBuffer, storedLegacyHash)) {
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
          contacts: sanitizeContacts(contacts),
          settings: sanitizeSettings(settings),
          lastSeen: row.last_seen || 'offline',
          status: 'offline',
          socketId: null,
        });
      });
      console.log(`[DATABASE] Loaded ${registeredUsers.size} user account(s) from SQLite`);

      const routeRows = sqliteDb.prepare('SELECT id, sender_tag, recipient_tag FROM message_routes ORDER BY created_at DESC LIMIT 50000').all().reverse();
      routeRows.forEach((row) => rememberMessageRoute(row.id, row.sender_tag, row.recipient_tag));

      // Load offline mailbox from SQLite
      const mailboxRows = sqliteDb.prepare('SELECT * FROM offline_mailbox ORDER BY queued_at ASC').all();
      mailboxRows.forEach((row) => {
        try {
          const msgObj = JSON.parse(row.message_json);
          const rTag = row.recipient_tag.toLowerCase();
          if (!offlineMailbox.has(rTag)) offlineMailbox.set(rTag, []);
          offlineMailbox.get(rTag).push(msgObj);
          if (msgObj.message?.id && msgObj.senderTag) {
            rememberMessageRoute(msgObj.message.id, msgObj.senderTag.toLowerCase(), rTag);
          }
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
            contacts: sanitizeContacts(user.contacts),
            settings: sanitizeSettings(user.settings),
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
        (offlineMailbox.get(lowerTag) || []).forEach((item) => {
          if (item.message?.id && item.senderTag) {
            rememberMessageRoute(item.message.id, item.senderTag.toLowerCase(), lowerTag);
          }
        });
      });
    }
  } catch (err) {
    console.error('[DATABASE] Error reading offline_mailbox.json:', err);
  }
}

function saveUser(user) {
  if (!user?.tag) return false;
  const tag = user.tag.toLowerCase();
  registeredUsers.set(tag, user);
  let sqliteSaved = false;

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
      sqliteSaved = true;
    } catch (err) {
      console.error('[DATABASE] Error writing user to SQLite:', err);
    }
  }

  // Mirror to users_db.json
  const jsonSaved = saveUserDatabaseFile();
  return sqliteSaved || jsonSaved;
}

function writeJsonAtomically(filePath, value) {
  const tempPath = `${filePath}.${process.pid}.${crypto.randomBytes(6).toString('hex')}.tmp`;
  try {
    fs.writeFileSync(tempPath, JSON.stringify(value, null, 2), { encoding: 'utf8', mode: 0o600 });
    fs.renameSync(tempPath, filePath);
  } catch (error) {
    try { fs.rmSync(tempPath, { force: true }); } catch { /* best-effort temporary file cleanup */ }
    throw error;
  }
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
        contacts: user.contacts || [],
        settings: user.settings || null,
      };
    });
    writeJsonAtomically(DB_FILE, obj);
    return true;
  } catch (err) {
    console.error('[DATABASE] Error saving users_db.json:', err);
    return false;
  }
}

function saveOfflineMailbox() {
  let sqliteSaved = false;
  let jsonSaved = false;
  // Save to SQLite
  if (sqliteDb) {
    try {
      sqliteDb.exec('BEGIN IMMEDIATE');
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
      sqliteDb.exec('COMMIT');
      sqliteSaved = true;
    } catch (err) {
      try { sqliteDb.exec('ROLLBACK'); } catch { /* transaction may not have started */ }
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
    writeJsonAtomically(MAILBOX_FILE, obj);
    jsonSaved = true;
  } catch (err) {
    console.error('[DATABASE] Error saving offline_mailbox.json:', err);
  }
  return sqliteSaved || jsonSaved;
}

loadDatabase();
for (const filePath of [DB_FILE, MAILBOX_FILE]) {
  if (fs.existsSync(filePath)) {
    try { fs.chmodSync(filePath, 0o600); } catch { /* permissions may be managed by the deployment */ }
  }
}

function getPublicPeerList() {
  const peers = [];
  registeredUsers.forEach((user) => {
    peers.push({
      id: `peer_${user.username.toLowerCase()}`,
      username: user.username,
      tag: user.tag,
      avatar: sanitizeAvatar(user.avatar),
      status: user.status || 'offline',
      lastSeen: user.lastSeen || 'offline',
      customStatus: user.customStatus || 'Active Node',
    });
  });
  return peers;
}

function touchUserOnline(tag, socketId) {
  if (!tag || tag === '@anonymous') return;
  const cleanTag = tag.toLowerCase();
  const user = registeredUsers.get(cleanTag);
  if (user) {
    const wasOffline = user.status !== 'online';
    user.status = 'online';
    if (socketId) user.socketId = socketId;
    user.lastSeen = 'online';
    if (wasOffline) {
      saveUser(user);
      io.emit('peers_update', getPublicPeerList());
    }
  }
}

// Socket.io Real-time Relay
io.on('connection', (socket) => {
  let authenticatedUser = null;

  const requireAuth = (callback) => {
    if (authenticatedUser) return true;
    callback?.({ success: false, error: 'Authentication required.' });
    return false;
  };

  // Authentication & Registration
  socket.on('authenticate_user', (data, callback) => {
    if (authenticatedUser) return callback?.({ success: false, error: 'This connection is already authenticated.' });
    if (!checkAuthRateLimit(socket)) {
      return callback?.({ success: false, error: 'Too many sign-in attempts. Try again later.' });
    }
    const { username, password, avatar, isRegisterMode } = data || {};
    const cleanUser = String(username || '').trim().replace(/^@/, '');
    const tag = `@${cleanUser.toLowerCase()}`;

    if (!cleanUser || cleanUser.length < 2 || cleanUser.length > 32) {
      return callback?.({ success: false, error: 'Username must be 2 to 32 characters.' });
    }
    if (!/^[a-zA-Z0-9_.-]+$/.test(cleanUser)) {
      return callback?.({ success: false, error: 'Username can only contain letters, numbers, dots, dashes, and underscores.' });
    }
    if (typeof password !== 'string' || password.length < (isRegisterMode ? 10 : 4) || Buffer.byteLength(password, 'utf8') > 1024) {
      recordAuthFailure(socket);
      return callback?.({ success: false, error: isRegisterMode ? 'Password must be 10 to 1024 bytes.' : 'Password must be at least 4 characters and no more than 1024 bytes.' });
    }

    if (isRegisterMode) {
      if (!takeWindowedLimit(registrationAttempts, getAuthAttemptKey(socket), 5, AUTH_WINDOW_MS)) {
        return callback?.({ success: false, error: 'Too many accounts created from this network. Try again later.' });
      }
      if (registeredUsers.has(tag)) {
        recordAuthFailure(socket);
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
        avatar: sanitizeAvatar(avatar),
        customStatus: 'Connected to Relay',
        status: 'online',
        socketId: socket.id,
        sessionToken,
        lastSeen: 'online',
      };

      if (!saveUser(newUser)) {
        registeredUsers.delete(tag);
        return callback?.({ success: false, error: 'Account could not be saved. Check the relay data directory permissions and try again.' });
      }
      authenticatedUser = newUser;
      failedAuthAttempts.delete(getAuthAttemptKey(socket));

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
      recordAuthFailure(socket);
      return callback?.({ success: false, error: 'No account found with that username. Choose "Create account" to register.' });
    }

    if (!verifyPassword(password, existingUser)) {
      recordAuthFailure(socket);
      return callback?.({ success: false, error: 'Incorrect password. Please try again.' });
    }
    failedAuthAttempts.delete(getAuthAttemptKey(socket));

    const oldSocketId = existingUser.socketId;
    const previousSession = {
      status: existingUser.status,
      socketId: existingUser.socketId,
      lastSeen: existingUser.lastSeen,
      avatar: existingUser.avatar,
      sessionToken: existingUser.sessionToken,
    };
    const newSessionToken = crypto.randomBytes(32).toString('hex');
    existingUser.status = 'online';
    existingUser.socketId = socket.id;
    existingUser.lastSeen = 'online';
    if (avatar) existingUser.avatar = sanitizeAvatar(avatar, existingUser.avatar);
    existingUser.sessionToken = newSessionToken;
    authenticatedUser = existingUser;
    if (!saveUser(existingUser)) {
      Object.assign(existingUser, previousSession);
      authenticatedUser = null;
      return callback?.({ success: false, error: 'Sign-in could not be saved. Check the relay data directory and try again.' });
    }

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
        avatar: sanitizeAvatar(existingUser.avatar),
        customStatus: existingUser.customStatus,
        status: 'online',
      },
      sessionToken: newSessionToken,
      contacts: sanitizeContacts(existingUser.contacts),
      settings: sanitizeSettings(existingUser.settings),
    });

    // Notify all clients of updated online status
    io.emit('peers_update', getPublicPeerList());

    const pendingMessages = offlineMailbox.get(tag) || [];
    if (pendingMessages.length > 0) {
      console.log(`[MAILBOX] Delivering ${pendingMessages.length} pending item(s) to ${tag}`);
      flushOfflineMailbox(socket.id, tag);
    }
  });

  // Reconnect with active session token
  socket.on('resume_session', (profile, callback) => {
    if (authenticatedUser) return callback?.({ success: false, error: 'This connection is already authenticated.' });
    if (!isValidTag(profile?.tag) || typeof profile?.sessionToken !== 'string' || !/^[a-f\d]{64}$/i.test(profile.sessionToken)) {
      return callback?.({ success: false, error: 'A valid tag and session token are required.' });
    }
    const tag = profile.tag.toLowerCase();
    const existing = registeredUsers.get(tag);
    if (!existing) {
      return callback?.({ success: false, error: 'User not registered' });
    }

    // Session Token Validation for Single-Session Enforcement
    const presentedToken = Buffer.from(profile.sessionToken);
    const storedToken = Buffer.from(existing.sessionToken || '');
    if (!storedToken.length || presentedToken.length !== storedToken.length || !crypto.timingSafeEqual(presentedToken, storedToken)) {
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
      contacts: sanitizeContacts(existing.contacts),
      settings: sanitizeSettings(existing.settings),
    });
    io.emit('peers_update', getPublicPeerList());

    flushOfflineMailbox(socket.id, tag);
  });

  // Send / Relay Message
  socket.on('send_message', (payload, callback) => {
    if (!requireAuth(callback)) return;
    const { recipientTag, message } = payload || {};
    if (!isValidTag(recipientTag) || !message || typeof message !== 'object' || Array.isArray(message)) return callback?.({ success: false, error: 'Invalid message payload' });
    if (!takeWindowedLimit(accountMessageRates, authenticatedUser.tag.toLowerCase(), 120, 60 * 1000)) {
      return callback?.({ success: false, error: 'Message rate limit reached. Try again shortly.' });
    }
    let messageSize;
    try { messageSize = Buffer.byteLength(JSON.stringify(message), 'utf8'); } catch { return callback?.({ success: false, error: 'Invalid message payload' }); }
    if (messageSize > MAX_MESSAGE_BYTES || typeof message.id !== 'string' || message.id.length > 128) {
      return callback?.({ success: false, error: 'Message is too large or has an invalid identifier.' });
    }

    const cleanRecipientTag = recipientTag.toLowerCase();
    const recipient = registeredUsers.get(cleanRecipientTag);
    const senderTag = authenticatedUser.tag;
    const senderUser = registeredUsers.get(senderTag.toLowerCase());
    if (!recipient) return callback?.({ success: false, error: 'Recipient account was not found.' });
    const knownRoute = messageRoutes.get(message.id);
    if (knownRoute) {
      if (knownRoute.senderTag !== senderTag || knownRoute.recipientTag !== cleanRecipientTag) {
        return callback?.({ success: false, error: 'Message identifier has already been used.' });
      }
      const queuedItem = (offlineMailbox.get(cleanRecipientTag) || []).find((item) => item.message?.id === message.id);
      if (queuedItem && recipient.socketId && io.sockets.sockets.has(recipient.socketId)) {
        sendMailboxItem(recipient.socketId, cleanRecipientTag, queuedItem);
      }
      callback?.({ success: true, status: queuedItem ? 'queued' : 'delivered' });
      return;
    }
    if (typeof message.text !== 'string' || message.text.length > 100000) {
      return callback?.({ success: false, error: 'Message text is invalid or too long.' });
    }
    const safeMessage = {
      id: message.id,
      sender: 'user',
      senderTag,
      senderAvatar: senderUser?.avatar || '',
      recipientTag: cleanRecipientTag,
      text: message.text,
      type: typeof message.type === 'string' ? message.type.slice(0, 32) : 'text',
      file: message.file && typeof message.file === 'object' ? {
        name: typeof message.file.name === 'string' ? message.file.name.slice(0, 255) : 'attachment',
        size: typeof message.file.size === 'string' ? message.file.size.slice(0, 32) : '',
        rawSize: Number.isFinite(message.file.rawSize) ? Math.max(0, message.file.rawSize) : 0,
        type: typeof message.file.type === 'string' ? message.file.type.slice(0, 128) : 'application/octet-stream',
        data: typeof message.file.data === 'string' ? message.file.data : '',
      } : null,
      audioUrl: typeof message.audioUrl === 'string' ? message.audioUrl : null,
      mediaUrl: typeof message.mediaUrl === 'string' ? message.mediaUrl : null,
      code: typeof message.code === 'string' ? message.code.slice(0, 100000) : null,
      language: typeof message.language === 'string' ? message.language.slice(0, 64) : null,
      fileName: typeof message.fileName === 'string' ? message.fileName.slice(0, 255) : null,
      fileSize: typeof message.fileSize === 'string' ? message.fileSize.slice(0, 32) : null,
      audioDuration: typeof message.audioDuration === 'string' ? message.audioDuration.slice(0, 32) : null,
      replyTo: message.replyTo && typeof message.replyTo === 'object' ? message.replyTo : null,
      burnAfterRead: Boolean(message.burnAfterRead),
      burnCountdown: Number.isFinite(message.burnCountdown) ? Math.max(0, Math.min(604800, message.burnCountdown)) : null,
      isTwoWay: Boolean(message.isTwoWay),
      isViewOnce: Boolean(message.isViewOnce),
      timestamp: typeof message.timestamp === 'string' ? message.timestamp.slice(0, 64) : new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      status: 'sent',
      reactions: {},
    };
    // Touch sender as online
    touchUserOnline(senderTag, socket.id);

    const senderInfo = {
      tag: senderTag,
      username: senderUser?.username || senderTag.replace(/^@/, ''),
      avatar: senderUser?.avatar || '',
    };

    const recipientQueue = offlineMailbox.get(cleanRecipientTag) || [];
    if (recipientQueue.length >= MAX_MAILBOX_MESSAGES) {
      return callback?.({ success: false, error: 'Recipient mailbox is full. Try again later.' });
    }

    const mailboxItem = { message: safeMessage, senderTag, senderInfo, queuedAt: Date.now() };
    recipientQueue.push(mailboxItem);
    offlineMailbox.set(cleanRecipientTag, recipientQueue);
    if (!saveOfflineMailbox()) {
      recipientQueue.pop();
      if (recipientQueue.length === 0) offlineMailbox.delete(cleanRecipientTag);
      return callback?.({ success: false, error: 'Message could not be saved by the relay. Please retry.' });
    }
    rememberMessageRoute(message.id, senderTag, cleanRecipientTag);
    callback?.({ success: true, status: 'queued' });
    socket.emit('message_status_update', { messageId: message.id, status: 'queued' });

    if (recipient.socketId && io.sockets.sockets.has(recipient.socketId)) {
      touchUserOnline(cleanRecipientTag, recipient.socketId);
      sendMailboxItem(recipient.socketId, cleanRecipientTag, mailboxItem);
    } else {
      console.log(`[MAILBOX] Queued message ${message.id} for offline user ${cleanRecipientTag}`);
    }
  });

  // Search User Directory
  socket.on('search_users', (query, callback) => {
    if (!requireAuth(callback)) return;
    if (!takeWindowedLimit(accountMessageRates, `${authenticatedUser.tag.toLowerCase()}:search`, 60, 60 * 1000)) {
      return callback?.([]);
    }
    const q = String(query || '').slice(0, 128).trim().toLowerCase().replace(/^@/, '');
    if (!q) return callback?.([]);

    const matches = [];
    registeredUsers.forEach((user) => {
      if (user.tag.toLowerCase() === authenticatedUser?.tag?.toLowerCase()) return;
      if (user.username.toLowerCase().includes(q) || user.tag.toLowerCase().includes(q)) {
        matches.push({
          id: `peer_${user.username.toLowerCase()}`,
          username: user.username,
          tag: user.tag,
          avatar: sanitizeAvatar(user.avatar),
          status: user.status || 'offline',
          lastSeen: user.lastSeen || 'offline',
          customStatus: user.customStatus || 'Registered Node',
        });
      }
    });

    callback?.(matches.slice(0, 25));
  });

  // Typing Indicator
  socket.on('typing', (payload) => {
    const { recipientTag, isTyping } = objectPayload(payload);
    if (!authenticatedUser || !isValidTag(recipientTag)) return;
    const senderTag = authenticatedUser.tag;
    if (senderTag) touchUserOnline(senderTag, socket.id);
    const recipient = registeredUsers.get(recipientTag.toLowerCase());
    if (recipient?.socketId) {
      io.to(recipient.socketId).emit('typing', {
        senderTag: senderTag || '@operator',
        isTyping: Boolean(isTyping),
      });
    }
  });

  // Read Receipt
  socket.on('message_read', (payload) => {
    const { messageId, recipientTag } = objectPayload(payload);
    if (!authenticatedUser || !isValidTag(recipientTag) || typeof messageId !== 'string') return;
    if (!isMessageRoute(messageId, recipientTag.toLowerCase(), authenticatedUser.tag.toLowerCase())) return;
    const sender = registeredUsers.get(recipientTag.toLowerCase());
    if (sender?.socketId) {
      io.to(sender.socketId).emit('message_status_update', {
        messageId,
        status: 'read',
      });
    }
  });

  // Delivery Receipt
  socket.on('message_delivered', (payload) => {
    const { messageId, recipientTag } = objectPayload(payload);
    if (!authenticatedUser || !isValidTag(recipientTag) || typeof messageId !== 'string') return;
    if (!isMessageRoute(messageId, recipientTag.toLowerCase(), authenticatedUser.tag.toLowerCase())) return;
    const sender = registeredUsers.get(recipientTag.toLowerCase());
    if (sender?.socketId) {
      io.to(sender.socketId).emit('message_status_update', {
        messageId,
        status: 'delivered',
      });
    }
  });

  // Message Reaction
  socket.on('message_reaction', (payload) => {
    const { messageId, recipientTag, emoji } = objectPayload(payload);
    if (!authenticatedUser || !isValidTag(recipientTag) || typeof messageId !== 'string' || typeof emoji !== 'string' || emoji.length > 16) return;
    if (!isMessageBetween(messageId, authenticatedUser.tag.toLowerCase(), recipientTag.toLowerCase())) return;
    const recipient = registeredUsers.get(recipientTag.toLowerCase());
    if (recipient?.socketId) {
      io.to(recipient.socketId).emit('message_reaction', {
        messageId,
        emoji,
      });
    }
  });

  // Message Delete (for everyone)
  socket.on('delete_message', (payload) => {
    const { messageId, recipientTag } = objectPayload(payload);
    if (!authenticatedUser || !isValidTag(recipientTag) || typeof messageId !== 'string') return;
    if (!isMessageRoute(messageId, authenticatedUser.tag.toLowerCase(), recipientTag.toLowerCase())) return;
    const recipient = registeredUsers.get(recipientTag.toLowerCase());
    if (recipient?.socketId) {
      io.to(recipient.socketId).emit('message_deleted', { messageId });
    }
  });

  // Message Shred (burn after reading / auto-delete)
  socket.on('message_shredded', (payload) => {
    const { messageId, recipientTag } = objectPayload(payload);
    if (!authenticatedUser || typeof messageId !== 'string' || messageId.length > 128) return;
    if (recipientTag) {
      if (!isValidTag(recipientTag)) return;
      if (!isMessageBetween(messageId, authenticatedUser.tag.toLowerCase(), recipientTag.toLowerCase())) return;
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
    if (!authenticatedUser || !isValidTag(recipientTag)) return;
    const cleanRecipientTag = recipientTag.toLowerCase();
    const recipient = registeredUsers.get(cleanRecipientTag);
    const senderTag = authenticatedUser.tag;
    const boundedSeconds = Math.max(0, Math.min(604800, Math.floor(Number(seconds) || 0)));

    touchUserOnline(senderTag, socket.id);

    if (recipient?.socketId) {
      io.to(recipient.socketId).emit('disappearing_timer_sync', {
        senderTag,
        seconds: boundedSeconds,
        isTwoWay: !!isTwoWay,
      });
    } else {
      if (!offlineMailbox.has(cleanRecipientTag)) {
        offlineMailbox.set(cleanRecipientTag, []);
      }
      offlineMailbox.get(cleanRecipientTag).push({
        type: 'disappearing_timer_sync',
        senderTag,
        seconds: boundedSeconds,
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
    if (Array.isArray(contacts) && contacts.length <= 1000) {
      authenticatedUser.contacts = sanitizeContacts(contacts);
      changed = true;
    }
    if (settings && typeof settings === 'object' && !Array.isArray(settings)) {
      authenticatedUser.settings = sanitizeSettings(settings);
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
    if (typeof updates?.avatar === 'string') authenticatedUser.avatar = sanitizeAvatar(updates.avatar, authenticatedUser.avatar);
    if (typeof updates?.customStatus === 'string') authenticatedUser.customStatus = updates.customStatus.slice(0, 80);
    saveUser(authenticatedUser);
    callback?.({ success: true });
    io.emit('peers_update', getPublicPeerList());
  });

  // Disconnect
  socket.on('disconnect', () => {
    if (authenticatedUser) {
      const userTag = authenticatedUser.tag.toLowerCase();
      const currentSocketId = socket.id;
      setTimeout(() => {
        const currentUser = registeredUsers.get(userTag);
        if (currentUser && currentUser.socketId === currentSocketId) {
          currentUser.status = 'offline';
          currentUser.socketId = null;
          currentUser.lastSeen = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
          saveUser(currentUser);
          console.log(`[DISCONNECT] ${currentUser.tag} went offline`);
          io.emit('peers_update', getPublicPeerList());
        }
      }, 3000);
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
