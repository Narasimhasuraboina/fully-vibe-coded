import { io } from 'socket.io-client';

class StandaloneSocketService {
  constructor() {
    this.socket = null;
    this.isConnected = false;
    this.currentProfile = null;
    this.callbacks = {};
  }

  setListeners(callbacks = {}) {
    this.callbacks = { ...this.callbacks, ...callbacks };
  }

  getServerUrl() {
    if (typeof window === 'undefined') return 'http://localhost:3001';
    // In dev mode (Vite running on port 5173), connect to backend port 3001
    if (window.location.port === '5173') {
      return `http://${window.location.hostname}:3001`;
    }
    // In production, backend serves the client from the same origin
    return window.location.origin;
  }

  initSocket() {
    if (this.socket) return this.socket;

    const serverUrl = this.getServerUrl();
    this.socket = io(serverUrl, {
      transports: ['websocket', 'polling'],
      reconnectionAttempts: 25,
      reconnectionDelay: 1000,
      timeout: 10000,
    });

    this.socket.on('connect', () => {
      this.isConnected = true;
      console.log('[REALTIME] Connected to Chatforge Relay Server at', serverUrl);
      this.callbacks.onConnect?.();

      if (this.currentProfile) {
        this.socket.emit('resume_session', this.currentProfile, (res) => {
          if (res?.success) {
            this.callbacks.onRegistered?.({ success: true });
          }
        });
      }
    });

    this.socket.on('disconnect', (reason) => {
      this.isConnected = false;
      console.log('[REALTIME] Disconnected from Relay Server:', reason);
      this.callbacks.onDisconnect?.();
    });

    this.socket.on('connect_error', (error) => {
      console.warn('[REALTIME] Connection error:', error.message);
      this.callbacks.onConnectionError?.(error);
    });

    // Incoming messages
    this.socket.on('receive_message', (data) => {
      this.callbacks.onMessageReceived?.(data);
      this.callbacks.onReceiveMessage?.(data);
    });

    // Peer directory updates
    this.socket.on('peers_update', (peers) => {
      this.callbacks.onPeersUpdate?.(peers);
    });

    // Message delivery and read receipts
    this.socket.on('message_status_update', (data) => {
      this.callbacks.onMessageStatusUpdate?.(data);
    });

    // Typing indicators
    this.socket.on('typing', (data) => {
      this.callbacks.onTyping?.(data);
      this.callbacks.onPeerTyping?.(data);
    });

    // Reaction updates
    this.socket.on('message_reaction', (data) => {
      this.callbacks.onMessageReacted?.(data);
    });

    // Message deleted
    this.socket.on('message_deleted', (data) => {
      this.callbacks.onMessageDeleted?.(data);
    });

    // Message shredded (view once)
    this.socket.on('message_shredded', (data) => {
      this.callbacks.onMessageShredded?.(data);
    });

    return this.socket;
  }

  // Authenticate or Register with password
  authenticateUser(authData, callback) {
    let responded = false;
    let timeoutId = null;

    const safeCallback = (res) => {
      if (responded) return;
      responded = true;
      if (timeoutId) clearTimeout(timeoutId);
      if (typeof callback === 'function') callback(res);
    };

    timeoutId = setTimeout(() => {
      safeCallback({ success: false, error: 'Relay server timed out. Check that the server is running on port 3001.' });
    }, 6000);

    const socket = this.initSocket();

    const doAuth = () => {
      socket.emit('authenticate_user', authData, (res) => {
        if (res?.success && res.peerInfo) {
          this.currentProfile = res.peerInfo;
        }
        safeCallback(res);
      });
    };

    if (socket.connected) {
      doAuth();
    } else {
      socket.once('connect', doAuth);
      socket.once('connect_error', (err) => {
        safeCallback({ success: false, error: `Could not connect to relay server: ${err.message}` });
      });
    }
  }

  connect(profile, callbacks = {}) {
    this.currentProfile = profile;
    this.callbacks = { ...this.callbacks, ...callbacks };
    const socket = this.initSocket();

    if (socket.connected && profile) {
      socket.emit('resume_session', profile);
    }
  }

  sendMessage(recipientTag, message) {
    const socket = this.initSocket();
    if (!socket.connected) {
      this.callbacks.onMessageRejected?.({ messageId: message?.id, error: 'Relay server offline. Message will be sent on reconnect.' });
      return false;
    }

    socket.emit('send_message', { recipientTag, message }, (response) => {
      if (response?.status) {
        this.callbacks.onMessageStatusUpdate?.({ messageId: message?.id, status: response.status });
      }
    });
    return true;
  }

  searchUsers(query, callback) {
    const socket = this.initSocket();
    if (socket.connected) {
      socket.emit('search_users', query, callback);
    } else {
      callback?.([]);
    }
  }

  emitTyping(recipientTag, isTyping) {
    const socket = this.initSocket();
    if (socket.connected) {
      socket.emit('typing', { recipientTag, isTyping: Boolean(isTyping) });
    }
  }

  emitDeliveryReceipt(messageId, recipientTag) {
    const socket = this.initSocket();
    if (socket.connected) {
      socket.emit('message_delivered', { messageId, recipientTag });
    }
  }

  emitReadReceipt(messageId, recipientTag) {
    const socket = this.initSocket();
    if (socket.connected) {
      socket.emit('message_read', { messageId, recipientTag });
    }
  }

  emitReaction(messageId, recipientTag, emoji) {
    const socket = this.initSocket();
    if (socket.connected) {
      socket.emit('message_reaction', { messageId, recipientTag, emoji });
    }
  }

  emitMessageDelete(messageId, recipientTag) {
    const socket = this.initSocket();
    if (socket.connected) {
      socket.emit('delete_message', { messageId, recipientTag });
    }
  }

  emitMessageShredded(messageId, recipientTag) {
    const socket = this.initSocket();
    if (socket.connected) {
      socket.emit('message_shredded', { messageId, recipientTag });
    }
  }

  emitMessageShred(messageId, recipientTag) {
    this.emitMessageShredded(messageId, recipientTag);
  }

  emit(event, data, callback) {
    const socket = this.initSocket();
    if (socket.connected) {
      socket.emit(event, data, callback);
    }
  }

  logoutSession() {
    this.disconnect();
  }

  disconnect() {
    this.isConnected = false;
    this.currentProfile = null;
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
  }
}

export const socketService = new StandaloneSocketService();
