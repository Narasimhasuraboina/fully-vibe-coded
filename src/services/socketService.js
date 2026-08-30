import { io } from 'socket.io-client';

class RealtimeSocketService {
  constructor() {
    this.socket = null;
    this.isConnected = false;
    this.currentProfile = null;
    this.listeners = new Map();
  }

  getServerUrl() {
    if (typeof window === 'undefined') return 'http://localhost:3001';
    if (window.location.port === '5173') {
      return `http://${window.location.hostname}:3001`;
    }
    return window.location.origin;
  }

  initSocket() {
    if (this.socket && this.isConnected) return this.socket;

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

    // Safety timeout: if relay server is cold-starting or offline, grant local operator session
    timeoutId = setTimeout(() => {
      safeCallback({
        success: true,
        peerInfo: {
          username: authData.username,
          avatar: authData.avatar || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&auto=format&fit=crop&q=80',
          tag: `@${authData.username.toLowerCase()}`,
          customStatus: authData.customStatus || 'Operating on Standby Matrix',
          localOnly: true,
        }
      });
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
        safeCallback({
          success: true,
          peerInfo: {
            username: authData.username,
            avatar: authData.avatar || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&auto=format&fit=crop&q=80',
            tag: `@${authData.username.toLowerCase()}`,
            customStatus: authData.customStatus || 'Operating in Standby Matrix',
            localOnly: true,
          }
        });
      });
    } else {
      safeCallback({
        success: true,
        peerInfo: {
          username: authData.username,
          avatar: authData.avatar || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&auto=format&fit=crop&q=80',
          tag: `@${authData.username.toLowerCase()}`,
          customStatus: authData.customStatus || 'Operating in Standby Matrix',
          localOnly: true,
        }
      });
    }
  }

  connect(profile, callbacks = {}) {
    this.currentProfile = profile;
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
            if (callbacks.onRegistered) callbacks.onRegistered(res);
          }
        });
      }

      if (callbacks.onConnect) callbacks.onConnect();
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
          if (callbacks.onRegistered) callbacks.onRegistered(res);
        }
      });
      if (callbacks.onConnect) callbacks.onConnect();
    }

    this.socket.on('disconnect', () => {
      this.isConnected = false;
      console.log('[REALTIME] Disconnected from Relay Server');
      if (callbacks.onDisconnect) callbacks.onDisconnect();
    });

    this.socket.on('registered', (data) => {
      if (callbacks.onRegistered) callbacks.onRegistered(data);
    });

    this.socket.on('online_peers_list', (peers) => {
      if (callbacks.onPeersUpdate) callbacks.onPeersUpdate(peers);
    });

    this.socket.on('peer_online_event', ({ peer }) => {
      if (callbacks.onPeerOnline) callbacks.onPeerOnline(peer);
      // Auto flush pending outbox for this newly online peer!
      this.flushOutboxForPeer(peer.tag, callbacks.onOutboxMessageDispatched);
    });

    this.socket.on('peer_offline_event', (data) => {
      if (callbacks.onPeerOffline) callbacks.onPeerOffline(data);
    });

    this.socket.on('receive_message', (payload) => {
      if (callbacks.onReceiveMessage) callbacks.onReceiveMessage(payload);
    });

    this.socket.on('message_delivered_ack', (ack) => {
      if (callbacks.onMessageDelivered) callbacks.onMessageDelivered(ack);
    });

    this.socket.on('message_queued_server_ack', (data) => {
      if (callbacks.onMessageQueuedInServerMailbox) callbacks.onMessageQueuedInServerMailbox(data);
    });

    this.socket.on('mailbox_delivered_summary', (data) => {
      if (callbacks.onMailboxDeliveredSummary) callbacks.onMailboxDeliveredSummary(data);
    });

    this.socket.on('peer_offline_ack', (ack) => {
      if (callbacks.onPeerOfflineAck) callbacks.onPeerOfflineAck(ack);
    });

    this.socket.on('message_viewed_by_peer', (data) => {
      if (callbacks.onMessageViewedByPeer) callbacks.onMessageViewedByPeer(data);
    });

    this.socket.on('message_shredded_ack', (data) => {
      if (callbacks.onMessageShredded) callbacks.onMessageShredded(data);
    });

    this.socket.on('peer_typing', (data) => {
      if (callbacks.onPeerTyping) callbacks.onPeerTyping(data);
    });

    this.socket.on('incoming_call_signal', (data) => {
      if (callbacks.onIncomingCall) callbacks.onIncomingCall(data);
    });

    this.socket.on('call_answered_signal', (data) => {
      if (callbacks.onCallAnswered) callbacks.onCallAnswered(data);
    });

    this.socket.on('ice_candidate_signal', (data) => {
      if (callbacks.onIceCandidate) callbacks.onIceCandidate(data);
    });

    this.socket.on('call_rejected_signal', (data) => {
      if (callbacks.onCallRejected) callbacks.onCallRejected(data);
    });

    this.socket.on('call_ended_signal', () => {
      if (callbacks.onCallEnded) callbacks.onCallEnded();
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
  emitMessageViewed(messageId, senderTag, burnDelay = 5) {
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

  // WebRTC Calling
  emitCallOffer(targetTag, callType, offer) {
    if (this.socket && this.isConnected) {
      this.socket.emit('call_offer', { targetTag, callType, offer });
    }
  }

  emitCallAnswer(callerTag, answer) {
    if (this.socket && this.isConnected) {
      this.socket.emit('call_answer', { callerTag, answer });
    }
  }

  emitIceCandidate(targetTag, candidate) {
    if (this.socket && this.isConnected) {
      this.socket.emit('ice_candidate', { targetTag, candidate });
    }
  }

  emitCallReject(callerTag, reason = 'CALL_DECLINED') {
    if (this.socket && this.isConnected) {
      this.socket.emit('call_reject', { callerTag, reason });
    }
  }

  emitCallEnd(targetTag) {
    if (this.socket && this.isConnected) {
      this.socket.emit('call_end', { targetTag });
    }
  }

  // SENDER-SIDE OFFLINE OUTBOX STORAGE (Zero Server Knowledge)
  getOutbox() {
    try {
      const raw = localStorage.getItem('chatforge_offline_outbox');
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
      localStorage.setItem('chatforge_offline_outbox', JSON.stringify(filtered));
      console.log(`[OUTBOX] Message ${message.id} queued in sender local storage for offline peer ${cleanTag}`);
    } catch (e) {
      console.error('[OUTBOX] Error saving to outbox', e);
    }
  }

  removeFromOutbox(messageId) {
    try {
      const outbox = this.getOutbox();
      const filtered = outbox.filter(item => item.id !== messageId);
      localStorage.setItem('chatforge_offline_outbox', JSON.stringify(filtered));
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
