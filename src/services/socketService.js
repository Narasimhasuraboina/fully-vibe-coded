import { io } from 'socket.io-client';

class RealtimeSocketService {
  constructor() {
    this.socket = null;
    this.isConnected = false;
    this.currentProfile = null;
    this.listeners = new Map();
    this.callbacks = {};
  }

  setListeners(callbacks = {}) {
    this.callbacks = { ...this.callbacks, ...callbacks };
  }

  getServerUrl() {
    if (typeof window === 'undefined') return 'http://localhost:3001';
    if (window.location.port === '5173') {
      return `http://${window.location.hostname}:3001`;
    }
    return window.location.origin;
  }

  initSocket() {
    if (this.socket) return this.socket;

    const serverUrl = this.getServerUrl();
    this.socket = io(serverUrl, {
      transports: ['websocket', 'polling'],
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
    });

    this.socket.on('connect', () => {
      this.isConnected = true;
      console.log('[REALTIME] Connected to Chatforge Relay Server at', serverUrl);
    });

    this.socket.on('disconnect', () => {
      this.isConnected = false;
      console.log('[REALTIME] Disconnected from Relay Server');
    });

    return this.socket;
  }

  // Authenticate / Register with Password (with resilient timeout & offline fallback)
  authenticateUser(authData, callback) {
    let responded = false;
    let timeoutId = null;

    const safeCallback = (res) => {
      if (responded) return;
      responded = true;
      if (timeoutId) clearTimeout(timeoutId);
      if (typeof callback === 'function') callback(res);
    };

    // Never grant an authenticated session without a server response.
    timeoutId = setTimeout(() => {
      safeCallback({ success: false, error: 'Relay server did not respond. Check the connection and try again.' });
    }, 4500);

    const socket = this.initSocket();

    if (socket && socket.connected) {
      socket.emit('authenticate_user', authData, (res) => {
        safeCallback(res);
      });
    } else if (socket) {
      socket.once('connect', () => {
        socket.emit('authenticate_user', authData, (res) => {
          safeCallback(res);
        });
      });
      socket.once('connect_error', () => {
        safeCallback({ success: false, error: 'Could not connect to the relay server.' });
      });
    } else {
      safeCallback({ success: false, error: 'Could not initialize a relay connection.' });
    }
  }

  connect(profile, callbacks = {}) {
    this.currentProfile = profile;
    if (callbacks && typeof callbacks === 'object') {
      this.callbacks = { ...this.callbacks, ...callbacks };
    }
    const serverUrl = this.getServerUrl();

    if (!this.socket) {
      this.socket = io(serverUrl, {
        transports: ['websocket', 'polling'],
        reconnection: true,
        reconnectionAttempts: Infinity,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 5000,
      });
    }

    // Cleanly rebind listeners on the existing socket
    this.socket.removeAllListeners();

    this.socket.on('connect', () => {
      this.isConnected = true;
      console.log('[REALTIME] Connected to Relay Server (Socket ID: ' + this.socket.id + ')');
      
      // If user has credentials, authenticate securely
      if (this.currentProfile) {
        this.socket.emit('authenticate_user', {
          username: this.currentProfile.username,
          password: this.currentProfile.password,
          avatar: this.currentProfile.avatar,
          customStatus: this.currentProfile.customStatus,
          isRegisterMode: false,
        }, (res) => {
          if (res && res.success) {
            if (this.callbacks.onRegistered) this.callbacks.onRegistered(res);
          }
        });
      }

      if (this.callbacks.onConnect) this.callbacks.onConnect();
    });

    // If socket is already active and connected, authenticate immediately
    if (this.socket.connected && this.currentProfile) {
      this.isConnected = true;
      this.socket.emit('authenticate_user', {
        username: this.currentProfile.username,
        password: this.currentProfile.password,
        avatar: this.currentProfile.avatar,
        customStatus: this.currentProfile.customStatus,
        isRegisterMode: false,
      }, (res) => {
        if (res && res.success) {
          if (this.callbacks.onRegistered) this.callbacks.onRegistered(res);
        }
      });
      if (this.callbacks.onConnect) this.callbacks.onConnect();
    }

    this.socket.on('disconnect', () => {
      this.isConnected = false;
      console.log('[REALTIME] Disconnected from Relay Server');
      if (this.callbacks.onDisconnect) this.callbacks.onDisconnect();
    });

    this.socket.on('registered', (data) => {
      if (this.callbacks.onRegistered) this.callbacks.onRegistered(data);
    });

    this.socket.on('online_peers_list', (peers) => {
      if (this.callbacks.onPeersUpdate) this.callbacks.onPeersUpdate(peers);
    });

    this.socket.on('peer_online_event', ({ peer }) => {
      if (this.callbacks.onPeerOnline) this.callbacks.onPeerOnline(peer);
      // Auto flush pending outbox for this newly online peer
      this.flushOutboxForPeer(peer.tag, this.callbacks.onOutboxMessageDispatched);
    });

    this.socket.on('peer_offline_event', (data) => {
      if (this.callbacks.onPeerOffline) this.callbacks.onPeerOffline(data);
    });

    this.socket.on('receive_message', (payload) => {
      if (this.callbacks.onReceiveMessage) this.callbacks.onReceiveMessage(payload);
    });

    this.socket.on('message_delivered_ack', (ack) => {
      if (this.callbacks.onMessageDelivered) this.callbacks.onMessageDelivered(ack);
      if (this.callbacks.onMessageStatusUpdate) {
        this.callbacks.onMessageStatusUpdate({ messageId: ack?.messageId, status: 'delivered' });
      }
    });

    this.socket.on('message_read_ack', (data) => {
      if (this.callbacks.onMessageStatusUpdate) {
        this.callbacks.onMessageStatusUpdate({ messageId: data?.messageId, status: 'read' });
      }
    });

    this.socket.on('message_reacted', (data) => {
      if (this.callbacks.onMessageReacted) this.callbacks.onMessageReacted(data);
    });

    this.socket.on('message_deleted', (data) => {
      if (this.callbacks.onMessageDeleted) this.callbacks.onMessageDeleted(data);
    });

    this.socket.on('message_queued_server_ack', (data) => {
      if (this.callbacks.onMessageQueuedInServerMailbox) this.callbacks.onMessageQueuedInServerMailbox(data);
    });

    this.socket.on('message_rejected', (data) => {
      if (this.callbacks.onMessageRejected) this.callbacks.onMessageRejected(data);
    });

    this.socket.on('rate_limit_exceeded', (data) => {
      if (this.callbacks.onRateLimitExceeded) this.callbacks.onRateLimitExceeded(data);
    });

    this.socket.on('mailbox_delivered_summary', (data) => {
      if (this.callbacks.onMailboxDeliveredSummary) this.callbacks.onMailboxDeliveredSummary(data);
    });

    this.socket.on('peer_offline_ack', (ack) => {
      if (this.callbacks.onPeerOfflineAck) this.callbacks.onPeerOfflineAck(ack);
    });

    this.socket.on('message_viewed_by_peer', (data) => {
      if (this.callbacks.onMessageViewedByPeer) this.callbacks.onMessageViewedByPeer(data);
    });

    this.socket.on('message_shredded_ack', (data) => {
      if (this.callbacks.onMessageShredded) this.callbacks.onMessageShredded(data);
    });

    this.socket.on('peer_typing', (data) => {
      if (this.callbacks.onPeerTyping) this.callbacks.onPeerTyping(data);
      if (this.callbacks.onTyping) this.callbacks.onTyping(data);
    });
  }

  // Send message through real-time socket
  sendMessage(recipientTag, message) {
    if (!this.socket || !this.isConnected) {
      // Offline -> save to outbox
      this.saveToOutbox(recipientTag, message);
      return false;
    }

    this.socket.emit('send_message', {
      recipientTag,
      senderTag: this.currentProfile?.tag,
      senderAvatar: this.currentProfile?.avatar,
      message,
    });
    return true;
  }

  // Search registered users by username (dual socket + REST API for maximum reliability)
  async searchUsers(query, callback) {
    const cleanQ = (query || '').trim().replace(/^@/, '');
    if (!cleanQ) {
      if (typeof callback === 'function') callback([]);
      return;
    }

    let completed = false;
    const safeCallback = (results) => {
      if (completed) return;
      completed = true;
      if (typeof callback === 'function') callback(results || []);
    };

    // 1. Try Socket Search
    if (this.socket && (this.isConnected || this.socket.connected)) {
      this.socket.emit('search_users', { query: cleanQ }, (results) => {
        if (Array.isArray(results)) {
          safeCallback(results);
        }
      });
    }

    // 2. Concurrently try HTTP REST Search
    try {
      const serverUrl = this.getServerUrl();
      const res = await fetch(`${serverUrl}/api/search?q=${encodeURIComponent(cleanQ)}`);
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data)) {
          safeCallback(data);
        }
      }
    } catch {
      // Ignore network errors in REST fallback
    }

    // 3. Fallback timeout if neither responded
    setTimeout(() => {
      safeCallback([]);
    }, 1200);
  }

  // Notify sender that message has been viewed (triggering 1-view burn countdown)
  emitMessageViewed(messageId, senderTag, burnDelay = 10) {
    if (this.socket && this.isConnected) {
      this.socket.emit('message_viewed', { messageId, senderTag, burnDelay });
    }
  }

  // Notify peer that message has been shredded
  emitMessageShredded(messageId, targetTag) {
    if (this.socket && this.isConnected) {
      this.socket.emit('message_shredded', { messageId, targetTag });
    }
  }

  // Typing indicator
  emitTyping(recipientTag, isTyping) {
    if (this.socket && this.isConnected) {
      this.socket.emit('typing_indicator', { recipientTag, isTyping });
    }
  }

  // Delivery confirmation receipt
  emitDeliveryReceipt(messageId, recipientTag) {
    if (this.socket && this.isConnected) {
      this.socket.emit('delivery_receipt', { messageId, recipientTag });
    }
  }

  // Read receipt (blue tick protocol)
  emitReadReceipt(messageId, senderTag) {
    if (this.socket && this.isConnected) {
      this.socket.emit('message_read', { messageId, senderTag });
    }
  }

  // Emoji reaction relay
  emitReaction(messageId, recipientTag, emoji) {
    if (this.socket && this.isConnected) {
      this.socket.emit('message_reaction', { messageId, recipientTag, emoji });
    }
  }

  // Delete message for everyone
  emitMessageDelete(messageId, targetTag) {
    if (this.socket && this.isConnected) {
      this.socket.emit('delete_message', { messageId, targetTag });
    }
  }

  // Generic emit helper
  emit(event, data, callback) {
    if (this.socket && this.isConnected) {
      if (typeof callback === 'function') {
        this.socket.emit(event, data, callback);
      } else {
        this.socket.emit(event, data);
      }
    }
  }

  disconnect() {
    if (this.socket) this.socket.disconnect();
    this.socket = null;
    this.isConnected = false;
    this.currentProfile = null;
  }

  // SENDER-SIDE OFFLINE OUTBOX STORAGE (Zero Server Knowledge)
  getOutboxStorageKey() {
    const tag = this.currentProfile?.tag || this.currentProfile?.username || 'anonymous';
    const safeTag = String(tag).trim().toLowerCase().replace(/[^a-z0-9_@-]/g, '_');
    return `chatforge_account_${safeTag}_offline_outbox`;
  }

  getOutbox() {
    try {
      const raw = localStorage.getItem(this.getOutboxStorageKey());
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  }

  saveToOutbox(recipientTag, message) {
    try {
      const cleanTag = (recipientTag || '').toLowerCase().trim();
      const outbox = this.getOutbox();
      const entry = {
        id: message.id,
        recipientTag: cleanTag,
        message,
        savedAt: Date.now(),
      };
      // Prevent duplicates
      const filtered = outbox.filter(item => item.id !== message.id);
      filtered.push(entry);
      localStorage.setItem(this.getOutboxStorageKey(), JSON.stringify(filtered));
      console.log(`[OUTBOX] Message ${message.id} queued in sender local storage for offline peer ${cleanTag}`);
    } catch (e) {
      console.error('[OUTBOX] Error saving to outbox', e);
    }
  }

  removeFromOutbox(messageId) {
    try {
      const outbox = this.getOutbox();
      const filtered = outbox.filter(item => item.id !== messageId);
      localStorage.setItem(this.getOutboxStorageKey(), JSON.stringify(filtered));
    } catch (e) {
      console.error('[OUTBOX] Error removing from outbox', e);
    }
  }

  // Flush Outbox when recipient comes online
  flushOutboxForPeer(peerTag, onDispatchCallback) {
    const cleanPeerTag = (peerTag || '').toLowerCase().trim();
    const outbox = this.getOutbox();
    const pendingForPeer = outbox.filter(item => (item.recipientTag || '').toLowerCase().trim() === cleanPeerTag);

    if (pendingForPeer.length > 0) {
      console.log(`[OUTBOX FLUSH] Peer ${cleanPeerTag} is now ONLINE! Flushing ${pendingForPeer.length} queued messages...`);
      pendingForPeer.forEach((item) => {
        // Send to peer now
        this.sendMessage(item.recipientTag, item.message);
        this.removeFromOutbox(item.id);
        if (onDispatchCallback) {
          onDispatchCallback(item.recipientTag, item.message);
        }
      });
    }
  }
}

export const socketService = new RealtimeSocketService();
