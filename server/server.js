import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import os from 'os';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DB_FILE = path.join(__dirname, 'users_db.json');
const MAILBOX_FILE = path.join(__dirname, 'offline_mailbox.json');

const app = express();
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

const server = http.createServer(app);
const io = new Server(server, {
  maxHttpBufferSize: 1e8, // 100MB for media payloads
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
  },
});

// Map of all registered users on the network:
// tag (e.g. '@operator') -> { socketId, username, tag, passwordHash, avatar, ip, lastSeen, status, customStatus }
const registeredUsers = new Map();

// Map of Offline Store-and-Forward Mailbox:
// recipientTag -> [ { message, senderInfo, queuedAt } ]
const offlineMailbox = new Map();

// Map of in-flight WebRTC ICE candidate queues:
// targetTag -> [ { candidate, fromTag, fromSocketId } ]
const callCandidateBuffer = new Map();

// Helper to hash password with quantum salt
function hashPassword(password, salt = 'chatforge_quantum_salt_v1') {
  return crypto.createHash('sha256').update(password + salt).digest('hex');
}

// Load persistent users DB
function loadUserDatabase() {
  try {
    if (fs.existsSync(DB_FILE)) {
      const data = fs.readFileSync(DB_FILE, 'utf8');
      const parsed = JSON.parse(data);
      Object.entries(parsed).forEach(([tag, user]) => {
        registeredUsers.set(tag.toLowerCase(), {
          ...user,
          status: 'offline',
          socketId: null,
        });
      });
      console.log(`[DATABASE] Loaded ${registeredUsers.size} registered users from ${DB_FILE}`);
    }
  } catch (err) {
    console.error('[DATABASE] Error loading users_db.json:', err);
  }
}

// Save persistent users DB
function saveUserDatabase() {
  try {
    const obj = {};
    registeredUsers.forEach((user, tag) => {
      obj[tag] = {
        username: user.username,
        tag: user.tag,
        passwordHash: user.passwordHash,
        avatar: user.avatar,
        customStatus: user.customStatus,
        registeredAt: user.registeredAt || Date.now(),
        lastSeen: user.lastSeen,
      };
    });
    fs.writeFileSync(DB_FILE, JSON.stringify(obj, null, 2), 'utf8');
  } catch (err) {
    console.error('[DATABASE] Error saving users_db.json:', err);
  }
}

// Load persistent store-and-forward offline mailbox
function loadMailboxDatabase() {
  try {
    if (fs.existsSync(MAILBOX_FILE)) {
      const data = fs.readFileSync(MAILBOX_FILE, 'utf8');
      const parsed = JSON.parse(data);
      Object.entries(parsed).forEach(([tag, msgs]) => {
        offlineMailbox.set(tag.toLowerCase(), Array.isArray(msgs) ? msgs : []);
      });
      console.log(`[MAILBOX] Loaded offline queues for ${offlineMailbox.size} users from ${MAILBOX_FILE}`);
    }
  } catch (err) {
    console.error('[MAILBOX] Error loading offline_mailbox.json:', err);
  }
}

// Save persistent offline mailbox
function saveMailboxDatabase() {
  try {
    const obj = {};
    offlineMailbox.forEach((msgs, tag) => {
      if (msgs && msgs.length > 0) {
        obj[tag] = msgs;
      }
    });
    fs.writeFileSync(MAILBOX_FILE, JSON.stringify(obj, null, 2), 'utf8');
  } catch (err) {
    console.error('[MAILBOX] Error saving offline_mailbox.json:', err);
  }
}

loadUserDatabase();
loadMailboxDatabase();

// Helper to sanitize user profile for client transmission (strips passwordHash)
function sanitizeUser(user) {
  if (!user) return null;
  const { passwordHash: _passwordHash, ...safe } = user;
  return safe;
}

function getSanitizedDirectory() {
  return Array.from(registeredUsers.values()).map(sanitizeUser);
}

// Helper to get local network IP address
function getLocalNetworkIP() {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal) {
        return iface.address;
      }
    }
  }
  return 'localhost';
}

const localIP = getLocalNetworkIP();

// API endpoint for server discovery
app.get('/api/info', (req, res) => {
  res.json({
    name: 'Chatforge Real-Time Zero-Knowledge Relay Server',
    status: 'ONLINE',
    localIP,
    port: 3001,
    registeredCount: registeredUsers.size,
  });
});

// REST API for operator lookup (supports both online & offline registered users)
app.get('/api/search', (req, res) => {
  const rawQ = req.query.q || '';
  const q = rawQ.toLowerCase().trim().replace(/^@/, '');
  if (!q || q.length < 1) {
    return res.json([]);
  }

  const allUsers = getSanitizedDirectory();
  const matches = allUsers.filter(u => 
    (u.username && u.username.toLowerCase().includes(q)) || 
    (u.tag && u.tag.toLowerCase().includes(q))
  );
  return res.json(matches);
});

// Helper to normalize any username / tag to standard @lowercase
function normalizeTag(input) {
  if (!input || typeof input !== 'string') return '';
  const clean = input.trim().replace(/^@/, '').toLowerCase();
  return clean ? `@${clean}` : '';
}

// Deliver all stored encrypted mailbox messages when a peer comes online
function deliverPendingMailboxMessages(targetTag, targetSocket) {
  const cleanTag = normalizeTag(targetTag);
  const pending = offlineMailbox.get(cleanTag) || [];

  if (pending.length > 0) {
    console.log(`[MAILBOX] Delivering ${pending.length} stored encrypted messages to ${cleanTag}`);
    
    // Deliver each message to the recipient socket
    pending.forEach((item) => {
      targetSocket.emit('receive_message', {
        message: item.message,
        senderInfo: item.senderInfo,
        fromMailbox: true,
      });

      // If the sender is online, send delivery confirmation
      const senderTag = normalizeTag(item.senderInfo?.tag);
      io.to(senderTag).emit('message_delivered_ack', {
        messageId: item.message?.id,
        recipientTag: cleanTag,
        status: 'delivered',
      });
    });

    // Also emit batch count for HUD notification
    targetSocket.emit('mailbox_delivered_summary', {
      count: pending.length,
    });

    // Drain mailbox
    offlineMailbox.delete(cleanTag);
    saveMailboxDatabase();
  }
}

io.on('connection', (socket) => {
  const clientIP = socket.handshake.headers['x-forwarded-for'] || socket.handshake.address || '127.0.0.1';

  // 1. Password-Protected Authentication & Registration
  socket.on('authenticate_user', (authData, callback) => {
    const rawUsername = authData.username || '';
    const cleanUser = rawUsername.trim().replace(/^@/, '');
    const tag = `@${cleanUser.toLowerCase()}`;
    const password = authData.password || '';
    const isRegisterMode = authData.isRegisterMode;

    if (!cleanUser || cleanUser.length < 2) {
      const resp = { success: false, error: 'Username must be at least 2 characters.' };
      if (typeof callback === 'function') callback(resp);
      else socket.emit('auth_response', resp);
      return;
    }

    if (!password || password.length < 4) {
      const resp = { success: false, error: 'Cipher passkey must be at least 4 characters.' };
      if (typeof callback === 'function') callback(resp);
      else socket.emit('auth_response', resp);
      return;
    }

    const passwordHash = hashPassword(password);
    const existing = registeredUsers.get(tag);

    if (existing) {
      // 1. If someone tries to register an already claimed username
      if (isRegisterMode) {
        console.log(`[REGISTRATION BLOCKED] Username "${tag}" is already claimed by an operator.`);
        const resp = { 
          success: false, 
          error: `Codename "${tag}" is permanently claimed. If this is your account, switch to LOGIN with your password.` 
        };
        if (typeof callback === 'function') callback(resp);
        else socket.emit('auth_response', resp);
        return;
      }

      // 2. Strict Password Verification - only the owner can access this username!
      if (existing.passwordHash !== passwordHash) {
        console.log(`[AUTH REJECTED] Unauthorized login attempt for claimed handle ${tag} from IP: ${clientIP}`);
        const resp = { 
          success: false, 
          error: `SECURITY ALERT: Passkey verification failed! Codename "${tag}" is owned by another operator.` 
        };
        if (typeof callback === 'function') callback(resp);
        else socket.emit('auth_response', resp);
        return;
      }

      // Password verified! Grant session to the legitimate owner
      socket.join(tag);
      existing.socketId = socket.id;
      existing.status = 'online';
      existing.lastSeen = 'online';
      existing.ip = clientIP;
      if (authData.avatar) existing.avatar = authData.avatar;
      if (authData.customStatus) existing.customStatus = authData.customStatus;

      socket.userTag = tag;
      saveUserDatabase();
      console.log(`[AUTH SUCCESS] Verified owner of ${cleanUser} (${tag}) logged in on socket ${socket.id}.`);

      const safeUser = sanitizeUser(existing);
      const resp = {
        success: true,
        peerInfo: safeUser,
        localIP,
      };

      if (typeof callback === 'function') callback(resp);
      socket.emit('registered', resp);

      // Flush any pending encrypted store-and-forward mailbox messages!
      deliverPendingMailboxMessages(tag, socket);

      socket.broadcast.emit('peer_online_event', {
        peer: safeUser,
        timestamp: Date.now(),
      });

    } else {
      // 3. New User Registration - permanently binds username to this passkey
      socket.join(tag);
      const newUser = {
        socketId: socket.id,
        username: cleanUser,
        tag,
        passwordHash,
        avatar: authData.avatar || `https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&auto=format&fit=crop&q=80`,
        ip: clientIP,
        status: 'online',
        customStatus: authData.customStatus || 'Active Node on Mesh Network',
        lastSeen: 'online',
        registeredAt: Date.now(),
      };

      registeredUsers.set(tag, newUser);
      socket.userTag = tag;
      saveUserDatabase();
      console.log(`[REGISTER SUCCESS] New Operator ${cleanUser} (${tag}) permanently registered.`);

      const safeUser = sanitizeUser(newUser);
      const resp = {
        success: true,
        peerInfo: safeUser,
        localIP,
      };

      if (typeof callback === 'function') callback(resp);
      socket.emit('registered', resp);

      // Flush any pending encrypted store-and-forward mailbox messages!
      deliverPendingMailboxMessages(tag, socket);

      socket.broadcast.emit('peer_online_event', {
        peer: safeUser,
        timestamp: Date.now(),
      });
    }
  });

  // Legacy fallback for register_peer (only for guests, cannot hijack registered names)
  socket.on('register_peer', (peerData) => {
    const rawUsername = peerData.username || `Guest_${socket.id.substring(0, 4)}`;
    const tag = normalizeTag(rawUsername);
    const existing = registeredUsers.get(tag);

    if (existing) {
      socket.emit('auth_response', { 
        success: false, 
        error: `Codename "${tag}" is password-protected. Please authenticate with password.` 
      });
      return;
    }
  });

  // 2. Private Codename Search (Requires exact or partial username, returns both online & offline registered users)
  socket.on('search_users', ({ query }, callback) => {
    const q = (query || '').toLowerCase().trim().replace(/^@/, '');
    
    // Privacy protection: If no search query is entered, do NOT expose user list!
    if (!q || q.length < 1) {
      if (typeof callback === 'function') callback([]);
      else socket.emit('search_results', []);
      return;
    }

    const allUsers = getSanitizedDirectory();
    // Match by username or @tag across all registered users (online & offline)
    const matches = allUsers.filter(u => 
      u.username.toLowerCase().includes(q) || 
      u.tag.toLowerCase().includes(q)
    );

    if (typeof callback === 'function') {
      callback(matches);
    } else {
      socket.emit('search_results', matches);
    }
  });

  // 3. Relay Message Protocol with Room-based Delivery & Store-and-Forward Encrypted Mailbox
  socket.on('send_message', (payload) => {
    let senderTag = socket.userTag;
    if (!senderTag && payload.senderTag) {
      senderTag = normalizeTag(payload.senderTag);
      socket.userTag = senderTag;
      socket.join(senderTag);
    }
    if (!senderTag && payload.message?.senderTag) {
      senderTag = normalizeTag(payload.message.senderTag);
      socket.userTag = senderTag;
      socket.join(senderTag);
    }

    let sender = senderTag ? registeredUsers.get(normalizeTag(senderTag)) : null;
    if (!sender && senderTag) {
      sender = {
        username: senderTag.replace(/^@/, ''),
        tag: senderTag,
        status: 'online',
        socketId: socket.id,
        avatar: payload.senderAvatar || `https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&auto=format&fit=crop&q=80`,
      };
      registeredUsers.set(senderTag, sender);
    }
    if (!sender) return;

    const { recipientTag, message } = payload;
    const cleanRecipientTag = normalizeTag(recipientTag);
    if (!cleanRecipientTag) return;

    // Check if recipient has an active connected socket in their room
    const recipientRoom = io.sockets.adapter.rooms.get(cleanRecipientTag);
    const isRecipientConnected = recipientRoom && recipientRoom.size > 0;

    if (isRecipientConnected) {
      // Recipient is ONLINE -> Deliver in real-time to recipient's active socket(s)!
      io.to(cleanRecipientTag).emit('receive_message', {
        message,
        senderInfo: sanitizeUser(sender),
      });

      // SYNC SENT MESSAGE TO SENDER'S OTHER LOGGED-IN DEVICES!
      socket.to(senderTag).emit('sync_sent_message', {
        recipientTag: cleanRecipientTag,
        message,
      });

      // Confirm delivered to sender
      socket.emit('message_delivered_ack', {
        messageId: message?.id,
        recipientTag: cleanRecipientTag,
        status: 'delivered',
      });

      console.log(`[DELIVERY LIVE] Message ${message?.id} from ${sender.tag} -> ${cleanRecipientTag} delivered live (and synced to sender's other devices).`);
    } else {
      // Recipient is OFFLINE -> Deposit in Zero-Knowledge Store-and-Forward Server Mailbox!
      const currentQueue = offlineMailbox.get(cleanRecipientTag) || [];
      const entry = {
        message,
        senderInfo: sanitizeUser(sender),
        queuedAt: Date.now(),
      };
      
      const filtered = currentQueue.filter(item => item.message?.id !== message?.id);
      filtered.push(entry);
      offlineMailbox.set(cleanRecipientTag, filtered);
      saveMailboxDatabase();

      console.log(`[MAILBOX] Message ${message?.id} from ${sender.tag} stored in encrypted mailbox for ${cleanRecipientTag} (Queue: ${filtered.length})`);

      // SYNC SENT MESSAGE TO SENDER'S OTHER LOGGED-IN DEVICES EVEN IF RECIPIENT IS OFFLINE!
      socket.to(senderTag).emit('sync_sent_message', {
        recipientTag: cleanRecipientTag,
        message,
      });

      // Acknowledge to sender that server mailbox accepted the packet
      socket.emit('message_queued_server_ack', {
        messageId: message?.id,
        recipientTag: cleanRecipientTag,
        queueCount: filtered.length,
      });

      socket.emit('peer_offline_ack', {
        messageId: message?.id,
        recipientTag: cleanRecipientTag,
        reason: 'SAVED_IN_SERVER_MAILBOX_WILL_DELIVER_ON_LOGIN',
      });
    }
  });

  // 4. Burn-After-Read (View-Once) Protocol (Synced across all active peer devices)
  socket.on('message_viewed', ({ messageId, senderTag, burnDelay = 5 }) => {
    const cleanSenderTag = normalizeTag(senderTag);
    const viewer = socket.userTag ? registeredUsers.get(normalizeTag(socket.userTag)) : null;

    io.to(cleanSenderTag).emit('message_viewed_by_peer', {
      messageId,
      viewerTag: viewer?.tag,
      burnDelay,
    });
    if (socket.userTag) {
      socket.to(normalizeTag(socket.userTag)).emit('message_viewed_by_peer', {
        messageId,
        viewerTag: viewer?.tag,
        burnDelay,
      });
    }
  });

  // 5. Message Shred Confirmation
  socket.on('message_shredded', ({ messageId, targetTag }) => {
    const cleanTargetTag = normalizeTag(targetTag);
    io.to(cleanTargetTag).emit('message_shredded_ack', { messageId });
    if (socket.userTag) {
      socket.to(normalizeTag(socket.userTag)).emit('message_shredded_ack', { messageId });
    }
  });

  // 6. Real-Time Typing Indicator
  socket.on('typing_indicator', ({ recipientTag, isTyping }) => {
    const sender = socket.userTag ? registeredUsers.get(normalizeTag(socket.userTag)) : null;
    if (!sender) return;

    const cleanRecipientTag = normalizeTag(recipientTag);
    io.to(cleanRecipientTag).emit('peer_typing', {
      senderTag: sender.tag,
      isTyping,
    });
  });

  // 7. WebRTC Audio / Video Call Signaling (Multi-device targeted with ICE Candidate Buffer)
  socket.on('call_offer', (data) => {
    const sender = socket.userTag ? registeredUsers.get(normalizeTag(socket.userTag)) : null;
    const cleanTargetTag = normalizeTag(data.targetTag);
    const targetRoom = io.sockets.adapter.rooms.get(cleanTargetTag);

    // Clear stale candidate buffer for target
    callCandidateBuffer.delete(cleanTargetTag);

    if (targetRoom && targetRoom.size > 0) {
      io.to(cleanTargetTag).emit('incoming_call_signal', {
        callerInfo: sanitizeUser(sender || { username: 'Operator', tag: socket.userTag || '@operator' }),
        callerSocketId: socket.id,
        callType: data.callType,
        offer: data.offer,
      });
    } else {
      socket.emit('call_rejected_signal', { reason: 'PEER_CURRENTLY_OFFLINE' });
    }
  });

  socket.on('call_answer', (data) => {
    const cleanCallerTag = normalizeTag(data.callerTag);
    const answeringSocketId = socket.id;

    if (data.callerSocketId) {
      io.to(data.callerSocketId).emit('call_answered_signal', {
        answer: data.answer,
        answerSocketId: answeringSocketId,
      });
    } else {
      io.to(cleanCallerTag).emit('call_answered_signal', {
        answer: data.answer,
        answerSocketId: answeringSocketId,
      });
    }

    // Flush any early buffered ICE candidates to this answering receiver socket!
    if (socket.userTag) {
      const userTag = normalizeTag(socket.userTag);
      const buffered = callCandidateBuffer.get(userTag) || [];
      if (buffered.length > 0) {
        console.log(`[WEBRTC] Flushing ${buffered.length} buffered ICE candidates to answering socket ${answeringSocketId}`);
        buffered.forEach((candData) => {
          socket.emit('ice_candidate_signal', candData);
        });
        callCandidateBuffer.delete(userTag);
      }
    }

    // Cancel call alert on callee's other devices
    if (socket.userTag) {
      socket.to(normalizeTag(socket.userTag)).emit('call_answered_elsewhere');
    }
  });

  socket.on('ice_candidate', (data) => {
    const cleanTargetTag = normalizeTag(data.targetTag);
    const candPayload = {
      candidate: data.candidate,
      fromTag: socket.userTag,
      fromSocketId: socket.id,
    };

    // Buffer candidate in case callee has not mounted CallModal yet
    const currentBuf = callCandidateBuffer.get(cleanTargetTag) || [];
    currentBuf.push(candPayload);
    callCandidateBuffer.set(cleanTargetTag, currentBuf);

    if (data.targetSocketId) {
      io.to(data.targetSocketId).emit('ice_candidate_signal', candPayload);
    } else {
      io.to(cleanTargetTag).emit('ice_candidate_signal', candPayload);
    }
  });

  socket.on('call_reject', (data) => {
    const cleanCallerTag = normalizeTag(data.callerTag);
    callCandidateBuffer.delete(cleanCallerTag);
    if (socket.userTag) callCandidateBuffer.delete(normalizeTag(socket.userTag));

    if (data.callerSocketId) {
      io.to(data.callerSocketId).emit('call_rejected_signal', {
        reason: data.reason || 'CALL_DECLINED_BY_PEER',
      });
    } else {
      io.to(cleanCallerTag).emit('call_rejected_signal', {
        reason: data.reason || 'CALL_DECLINED_BY_PEER',
      });
    }
  });

  socket.on('call_end', (data) => {
    const cleanTargetTag = normalizeTag(data.targetTag);
    callCandidateBuffer.delete(cleanTargetTag);
    if (socket.userTag) callCandidateBuffer.delete(normalizeTag(socket.userTag));

    io.to(cleanTargetTag).emit('call_ended_signal');
    if (socket.userTag) {
      socket.to(normalizeTag(socket.userTag)).emit('call_ended_signal');
    }
  });

  // 8. Disconnect Handler
  socket.on('disconnect', () => {
    if (socket.userTag) {
      const tag = normalizeTag(socket.userTag);
      const room = io.sockets.adapter.rooms.get(tag);
      const stillOnline = room && room.size > 0;

      if (!stillOnline) {
        const user = registeredUsers.get(tag);
        if (user) {
          user.status = 'offline';
          user.lastSeen = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
          user.socketId = null;
          saveUserDatabase();

          console.log(`[USER OFFLINE] ${user.username} (${user.tag}) went offline`);

          socket.broadcast.emit('peer_offline_event', {
            tag: user.tag,
            lastSeen: user.lastSeen,
          });
        }
      }
    }
  });
});



// Health check endpoint for Render / Cloud deployments
app.get('/healthz', (req, res) => {
  res.status(200).send('OK');
});

// Serve static frontend files for single-port / production / tunneling
const DIST_PATH = path.join(__dirname, '../dist');
if (fs.existsSync(DIST_PATH)) {
  app.use(express.static(DIST_PATH));
  app.use((req, res, next) => {
    if (req.path.startsWith('/api') || req.path.startsWith('/socket.io') || req.path === '/healthz') {
      return next();
    }
    res.sendFile(path.join(DIST_PATH, 'index.html'));
  });
} else {
  app.use((req, res, next) => {
    if (req.path.startsWith('/api') || req.path.startsWith('/socket.io')) {
      return next();
    }
    res.status(200).send(`
      <!DOCTYPE html>
      <html>
      <head><title>Chatforge Relay Engine</title></head>
      <body style="background:#020502;color:#00ff66;font-family:monospace;padding:30px;line-height:1.6;">
        <h2>[CHATFORGE RELAY ENGINE ONLINE]</h2>
        <p>Backend Socket.io Server is running on port ${process.env.PORT || 3001}.</p>
        <p><strong>To render the frontend UI:</strong></p>
        <ol>
          <li>Run <code>npm run build</code> to generate the <code>dist/</code> folder.</li>
          <li>On Render/Railway, set your <strong>Build Command</strong> to: <code>npm install && npm run build</code></li>
        </ol>
      </body>
      </html>
    `);
  });
}

const PORT = process.env.PORT || 3001;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`[CHATFORGE RELAY ENGINE] Running on port ${PORT}`);
  console.log(`[LOCAL MESH URL] http://localhost:${PORT}`);
  console.log(`[NETWORK LAN URL] http://${localIP}:${PORT}`);
  console.log(`[USER DATABASE & AUTH] Active. Password protection & persistent user storage enabled.`);
});
