import express from 'express';
import http from 'node:http';
import { Server } from 'socket.io';
import cors from 'cors';
import compression from 'compression';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = path.resolve(__dirname, '../data');
if (!fs.existsSync(DATA_DIR)) {
  try { fs.mkdirSync(DATA_DIR, { recursive: true }); } catch { /* ignore */ }
}
const DB_FILE = path.join(DATA_DIR, 'users_db.json');
const MAILBOX_FILE = path.join(DATA_DIR, 'offline_mailbox.json');

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
// registeredUsers: tag (e.g. '@neo') -> { username, tag, passwordHash, salt, avatar, customStatus, socketId, status, lastSeen, sessionToken }
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
    saveUserDatabase();
    return true;
  }
  return false;
}

function loadDatabase() {
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
      Object.entries(data).forEach(([tag, user]) => {
        registeredUsers.set(tag.toLowerCase(), {
          ...user,
          status: 'offline',
          socketId: null,
        });
      });
      console.log(`[DATABASE] Loaded ${registeredUsers.size} user account(s) from ${DB_FILE}`);
    }
  } catch (err) {
    console.error('[DATABASE] Error reading users_db.json:', err);
  }

  try {
    const legacyMailboxFile = path.join(__dirname, 'offline_mailbox.json');
    if (!fs.existsSync(MAILBOX_FILE) && fs.existsSync(legacyMailboxFile)) {
      try {
        fs.copyFileSync(legacyMailboxFile, MAILBOX_FILE);
        console.log(`[DATABASE] Migrated existing mailbox to ${MAILBOX_FILE}`);
      } catch { /* ignore */ }
    }
    if (fs.existsSync(MAILBOX_FILE)) {
      const data = JSON.parse(fs.readFileSync(MAILBOX_FILE, 'utf8') || '{}');
      Object.entries(data).forEach(([tag, msgs]) => {
        offlineMailbox.set(tag.toLowerCase(), msgs);
      });
      console.log(`[DATABASE] Loaded offline mailboxes for ${offlineMailbox.size} user(s)`);
    }
  } catch (err) {
    console.error('[DATABASE] Error reading offline_mailbox.json:', err);
  }
}

function saveUserDatabase() {
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
      };
    });
    fs.writeFileSync(DB_FILE, JSON.stringify(obj, null, 2), 'utf8');
  } catch (err) {
    console.error('[DATABASE] Error saving users_db.json:', err);
  }
}

function saveOfflineMailbox() {
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

    existingUser.status = 'online';
    existingUser.socketId = socket.id;
    existingUser.lastSeen = 'online';
    if (avatar) existingUser.avatar = avatar;
    existingUser.sessionToken = crypto.randomBytes(32).toString('hex');
    authenticatedUser = existingUser;

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
      sessionToken: existingUser.sessionToken,
    });

    // Notify all clients of updated online status
    io.emit('peers_update', getPublicPeerList());

    // Flush any pending offline mailbox messages for this user
    const pendingMessages = offlineMailbox.get(tag) || [];
    if (pendingMessages.length > 0) {
      console.log(`[MAILBOX] Flushing ${pendingMessages.length} offline message(s) to ${tag}`);
      pendingMessages.forEach((item) => {
        socket.emit('receive_message', {
          message: item.message,
          senderTag: item.senderTag,
          senderInfo: item.senderInfo,
        });
      });
      offlineMailbox.delete(tag);
      saveOfflineMailbox();
    }
  });

  // Reconnect with active session token
  socket.on('resume_session', (profile, callback) => {
    if (!profile?.tag) return callback?.({ success: false });
    const tag = profile.tag.toLowerCase();
    const existing = registeredUsers.get(tag);
    if (existing) {
      existing.status = 'online';
      existing.socketId = socket.id;
      existing.lastSeen = 'online';
      authenticatedUser = existing;

      callback?.({ success: true });
      io.emit('peers_update', getPublicPeerList());

      // Flush offline messages
      const pendingMessages = offlineMailbox.get(tag) || [];
      if (pendingMessages.length > 0) {
        pendingMessages.forEach((item) => {
          socket.emit('receive_message', {
            message: item.message,
            senderTag: item.senderTag,
            senderInfo: item.senderInfo,
          });
        });
        offlineMailbox.delete(tag);
        saveOfflineMailbox();
      }
    } else {
      callback?.({ success: false });
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

  // Message Shred (burn after reading)
  socket.on('message_shredded', ({ messageId, recipientTag }) => {
    if (!recipientTag) return;
    const recipient = registeredUsers.get(recipientTag.toLowerCase());
    if (recipient?.socketId) {
      io.to(recipient.socketId).emit('message_shredded', { messageId });
    }
  });

  // Update Profile / Status
  socket.on('update_profile', (updates, callback) => {
    if (!authenticatedUser) return callback?.({ success: false, error: 'Not authenticated' });
    if (updates?.avatar) authenticatedUser.avatar = updates.avatar;
    if (updates?.customStatus) authenticatedUser.customStatus = updates.customStatus;
    saveUserDatabase();
    callback?.({ success: true });
    io.emit('peers_update', getPublicPeerList());
  });

  // Disconnect
  socket.on('disconnect', () => {
    if (authenticatedUser) {
      authenticatedUser.status = 'offline';
      authenticatedUser.socketId = null;
      authenticatedUser.lastSeen = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      saveUserDatabase();
      console.log(`[DISCONNECT] ${authenticatedUser.tag} went offline`);
      io.emit('peers_update', getPublicPeerList());
    }
  });
});

// REST Health and Info Endpoints
app.get('/healthz', (_req, res) => res.status(200).send('OK'));

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
