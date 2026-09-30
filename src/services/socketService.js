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
    return window.location.origin;
  }

  initSocket() {
    if (this.socket) return this.socket;

    const serverUrl = this.getServerUrl();
    this.socket = io(serverUrl, {
      transports: ['polling', 'websocket'],
      reconnectionAttempts: 50,
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
            if (res.contacts || res.settings) {
              this.callbacks.onAccountSynced?.(res);
            }
          } else if (res?.error === 'Session expired') {
            this.callbacks.onForceLogout?.({ reason: 'Session expired. You were logged into this account on another device.' });
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

    // Ephemeral disappearing timer sync (Two-way or one-way notification)
    this.socket.on('disappearing_timer_sync', (data) => {
      this.callbacks.onDisappearingTimerSync?.(data);
    });

    // Single active device enforcement: kicked out because user logged in on another device
    this.socket.on('force_logout', (data) => {
      console.warn('[REALTIME] Force logout received:', data?.reason);
      this.currentProfile = null;
      this.callbacks.onForceLogout?.(data);
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
          this.currentProfile = {
            ...res.peerInfo,
            sessionToken: res.sessionToken,
            contacts: res.contacts || [],
            settings: res.settings || null,
          };
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
      socket.emit('resume_session', profile, (res) => {
        if (res?.success) {
          this.callbacks.onRegistered?.({ success: true });
          if (res.contacts || res.settings) {
            this.callbacks.onAccountSynced?.(res);
          }
        } else if (res?.error === 'Session expired') {
          this.callbacks.onForceLogout?.({ reason: 'Session expired. You were logged into this account on another device.' });
        }
      });
    }
  }

  syncAccountState(contacts, settings) {
    const socket = this.initSocket();
    if (socket.connected && this.currentProfile) {
      socket.emit('sync_account_state', { contacts, settings });
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

  emitSetDisappearingTimer(recipientTag, seconds, isTwoWay = true) {
    const socket = this.initSocket();
    if (socket.connected) {
      socket.emit('set_disappearing_timer', {
        senderTag: this.currentProfile?.tag,
        recipientTag,
        seconds,
        isTwoWay,
      });
    }
  }

  emit(event, data, callback) {
    const socket = this.initSocket();
    if (socket.connected) {
      socket.emit(event, data, callback);
    }
  }

  logoutSession() {
    if (this.socket?.connected) {
      this.socket.emit('logout_session');
    }
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
