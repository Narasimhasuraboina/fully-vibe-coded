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

  // Authenticate / Register with Password
  authenticateUser(authData, callback) {
    const sock = this.initSocket();

    if (sock.connected) {
      sock.emit('authenticate_user', authData, callback);
    } else {
      sock.once('connect', () => {
        sock.emit('authenticate_user', authData, callback);
      });
    }
  }

  connect(profile, callbacks = {}) {
    this.currentProfile = profile;
    const serverUrl = this.getServerUrl();

    if (this.socket) {
      this.socket.disconnect();
    }

    this.socket = io(serverUrl, {
      transports: ['websocket', 'polling'],
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
    });

    this.socket.on('connect', () => {
      this.isConnected = true;
      console.log('[REALTIME] Connected to Chatforge Relay Server');
      
      // If user has credentials, authenticate securely
      if (profile) {
        this.socket.emit('authenticate_user', {
          username: profile.username,
          password: profile.password,
          avatar: profile.avatar,
          customStatus: profile.customStatus,
          isRegisterMode: false,
        }, (res) => {
          if (res && res.success) {
            if (callbacks.onRegistered) callbacks.onRegistered(res);
          }
        });
      }

      if (callbacks.onConnect) callbacks.onConnect();
    });

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
      message,
    });
    return true;
  }

  // Search registered users by username
  searchUsers(query, callback) {
    const sock = this.initSocket();
    if (sock && (this.isConnected || sock.connected)) {
      sock.emit('search_users', { query }, (results) => {
        if (typeof callback === 'function') {
          callback(results);
        }
      });
    } else {
      sock.once('connect', () => {
        sock.emit('search_users', { query }, (results) => {
          if (typeof callback === 'function') {
            callback(results);
          }
        });
      });
    }
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
      const outbox = this.getOutbox();
      const entry = {
        id: message.id,
        recipientTag,
        message,
        savedAt: Date.now(),
      };
      // Prevent duplicates
      const filtered = outbox.filter(item => item.id !== message.id);
      filtered.push(entry);
      localStorage.setItem('chatforge_offline_outbox', JSON.stringify(filtered));
      console.log(`[OUTBOX] Message ${message.id} queued in sender local storage for offline peer ${recipientTag}`);
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
    const outbox = this.getOutbox();
    const pendingForPeer = outbox.filter(item => item.recipientTag === peerTag);

    if (pendingForPeer.length > 0) {
      console.log(`[OUTBOX FLUSH] Peer ${peerTag} is now ONLINE! Flushing ${pendingForPeer.length} queued messages...`);
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
