import { loadDurableData, saveDurableData } from './storage';

const DEFAULT_HOMESERVER = 'https://matrix.org';
const CHAT_EVENT_TYPE = 'm.room.message';

class MatrixChatService {
  constructor() {
    this.client = null;
    this.isConnected = false;
    this.currentProfile = null;
    this.callbacks = {};
    this.eventByMessageId = new Map();
    this.roomByPeer = new Map();
    this.started = false;
    this.startPromise = null;
    this.libraryPromise = null;
    this.sdk = null;
    this.encryptAttachment = null;
    this.decryptAttachment = null;
    this.deriveRecoveryKeyFromPassphrase = null;
    this.cryptoPromise = null;
    this.cryptoReady = false;
  }

  async loadLibraries() {
    if (!this.libraryPromise) {
      this.libraryPromise = Promise.all([
        import('matrix-js-sdk'),
        import('matrix-js-sdk/lib/crypto-api/key-passphrase'),
        import('matrix-encrypt-attachment'),
      ]).then(([matrix, keyPassphrase, attachments]) => {
        this.sdk = matrix;
        this.deriveRecoveryKeyFromPassphrase = keyPassphrase.deriveRecoveryKeyFromPassphrase;
        this.encryptAttachment = attachments.encryptAttachment;
        this.decryptAttachment = attachments.decryptAttachment;
      }).catch((error) => {
        this.libraryPromise = null;
        throw error;
      });
    }
    await this.libraryPromise;
  }

  setListeners(callbacks = {}) {
    this.callbacks = { ...this.callbacks, ...callbacks };
  }

  homeserverUrl() {
    return (import.meta.env?.VITE_MATRIX_HOMESERVER_URL || DEFAULT_HOMESERVER).replace(/\/$/, '');
  }

  createClient(session, password = '') {
    const callbacks = {
      getSecretStorageKey: async ({ keys }) => {
        if (!password) throw new Error('Sign in again with your password to unlock the encrypted key backup.');
        for (const [keyId, keyInfo] of Object.entries(keys || {})) {
          const passphrase = keyInfo?.passphrase;
          if (passphrase?.salt && passphrase?.iterations) {
            const key = await this.deriveRecoveryKeyFromPassphrase(password, passphrase.salt, passphrase.iterations);
            return [keyId, key];
          }
        }
        return null;
      },
    };
    return this.sdk.createClient({
      baseUrl: session.homeserver || this.homeserverUrl(),
      accessToken: session.sessionToken,
      userId: session.matrixUserId || session.tag,
      deviceId: session.deviceId,
      refreshToken: session.refreshToken,
      onTokenRefresh: (tokens) => {
        this.currentProfile = { ...this.currentProfile, sessionToken: tokens.accessToken, refreshToken: tokens.refreshToken };
        this.callbacks.onProfileUpdated?.(this.currentProfile);
      },
      cryptoCallbacks: callbacks,
    });
  }

  async initializeCrypto(client, password = '') {
    if (this.cryptoReady) return;
    if (!this.cryptoPromise) {
      this.cryptoPromise = (async () => {
        await client.initRustCrypto();
        if (password) {
          const crypto = client.getCrypto();
          await crypto.bootstrapSecretStorage({
            createSecretStorageKey: () => crypto.createRecoveryKeyFromPassphrase(password),
            setupNewKeyBackup: true,
          });
          await crypto.checkKeyBackupAndEnable();
        }
      })().then(() => { this.cryptoReady = true; }).catch((error) => {
        this.cryptoPromise = null;
        throw error;
      });
    }
    await this.cryptoPromise;
  }

  authenticateUser(authData, callback) {
    this.authenticate(authData).then((response) => callback?.(response)).catch((error) => {
      callback?.({ success: false, error: this.describeError(error) });
    });
  }

  async authenticate({ username, password, isRegisterMode }) {
    await this.loadLibraries();
    const cleanUsername = String(username || '').trim().replace(/^@/, '').toLowerCase();
    const homeserver = this.homeserverUrl();
    const unauthenticatedClient = sdk.createClient({ baseUrl: homeserver });
    let authResponse;

    if (isRegisterMode) {
      authResponse = await unauthenticatedClient.register(
        cleanUsername,
        password,
        null,
        { type: 'm.login.dummy' },
        undefined,
        undefined,
        false,
      );
    } else {
      authResponse = await unauthenticatedClient.loginRequest({
        type: 'm.login.password',
        identifier: { type: 'm.id.user', user: cleanUsername },
        password,
        initial_device_display_name: 'Chatforge Web',
      });
    }

    const matrixUserId = authResponse.user_id;
    if (!matrixUserId || !authResponse.access_token) throw new Error('This homeserver requires an extra registration step. Use an existing Matrix account, or complete its registration verification first.');
    const profile = {
      username: matrixUserId.split(':')[0].slice(1),
      tag: matrixUserId,
      matrixUserId,
      deviceId: authResponse.device_id,
      avatar: '',
      sessionToken: authResponse.access_token,
      refreshToken: authResponse.refresh_token,
      homeserver,
    };

    this.client = this.createClient(profile, password);
    this.currentProfile = profile;
    await this.initializeCrypto(this.client, password);
    this.bindClientEvents();
    await this.startClient();
    return { success: true, peerInfo: profile, sessionToken: profile.sessionToken };
  }

  connect(profile, callbacks = {}) {
    this.currentProfile = profile;
    this.callbacks = { ...this.callbacks, ...callbacks };
    Promise.resolve().then(() => this.loadLibraries()).then(async () => {
      if (!this.client) this.client = this.createClient(profile);
      this.bindClientEvents();
      await this.initializeCrypto(this.client);
      await this.startClient();
    }).catch((error) => {
      this.callbacks.onSessionExpired?.({ error: this.describeError(error) });
    });
  }

  bindClientEvents() {
    if (!this.client || this.started) return;
    this.started = true;
    this.client.on(this.sdk.ClientEvent.Sync, (state) => {
      if (state === this.sdk.SyncState.Prepared || state === this.sdk.SyncState.Syncing) {
        const wasConnected = this.isConnected;
        this.isConnected = true;
      if (!wasConnected) {
          this.callbacks.onConnect?.();
          this.callbacks.onRegistered?.({ success: true });
          this.emitPeerDirectory();
          this.flushOutbox();
        }
      } else if (state === sdk.SyncState.Error) {
        this.isConnected = false;
        this.callbacks.onDisconnect?.();
      }
    });
    this.client.on(this.sdk.RoomEvent.Timeline, (event, room, toStartOfTimeline) => {
      if (toStartOfTimeline || !room) return;
      const type = event.getType();
      if (type === CHAT_EVENT_TYPE && room.hasEncryptionStateEvent()) this.handleRoomMessage(event, room);
      else if (type === 'm.room.member') this.emitPeerDirectory();
    });
    this.client.on(this.sdk.RoomEvent.MyMembership, (room, membership) => {
      if (membership === this.sdk.KnownMembership.Invite) this.client.joinRoom(room.roomId).catch(() => {});
    });
  }

  async startClient() {
    if (!this.client || this.startPromise) return this.startPromise;
    this.startPromise = this.client.startClient({ initialSyncLimit: 30 }).finally(() => {
      this.startPromise = null;
    });
    return this.startPromise;
  }

  emitPeerDirectory() {
    const directEvent = this.client?.getAccountData('m.direct');
    const directRooms = directEvent?.getContent?.() || {};
    const contacts = Object.entries(directRooms).flatMap(([peerId, roomIds]) => {
      const roomId = roomIds?.[0];
      if (roomId) this.roomByPeer.set(peerId, roomId);
      return [{ tag: peerId, username: peerId.split(':')[0].slice(1), id: `peer_${peerId}`, status: 'offline', lastSeen: 'offline' }];
    });
    this.callbacks.onPeersUpdate?.(contacts);
  }

  handleRoomMessage(event, room) {
    const content = event.getContent?.() || {};
    let message;
    try { message = JSON.parse(content.body || ''); } catch { return; }
    if (!message?.id) return;
    const senderTag = event.getSender();
    this.eventByMessageId.set(message.id, { event, roomId: room.roomId, senderTag });
    this.decryptMessageAttachment(message).then((decryptedMessage) => {
      this.deliverIncomingMessage(decryptedMessage, event, room, senderTag);
    }).catch((error) => {
      this.callbacks.onMessageRejected?.({ messageId: message.id, error: `Could not decrypt attachment: ${this.describeError(error)}` });
    });
  }

  async decryptMessageAttachment(message) {
    const encryptedFile = message.encryptedFile;
    if (!encryptedFile?.url || !encryptedFile.info) return message;
    const url = this.client.mxcUrlToHttp(encryptedFile.url, undefined, undefined, undefined, false, false, true);
    if (!url) throw new Error('The homeserver returned an invalid media URL.');
    const response = await fetch(url, { headers: { Authorization: `Bearer ${this.currentProfile.sessionToken}` } });
    if (!response.ok) throw new Error(`Encrypted attachment download failed (${response.status}).`);
    const plaintext = await this.decryptAttachment(await response.arrayBuffer(), encryptedFile.info);
    const blob = new Blob([plaintext], { type: encryptedFile.contentType || 'application/octet-stream' });
    const data = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => reject(reader.error || new Error('Could not read the decrypted attachment.'));
      reader.readAsDataURL(blob);
    });
    const { encryptedFile: _encryptedFile, ...cleanMessage } = message;
    const file = { ...(message.file || {}), data, url: data, type: encryptedFile.contentType || message.file?.type };
    return { ...cleanMessage, file, mediaUrl: data, audioUrl: message.type === 'audio' ? data : message.audioUrl };
  }

  deliverIncomingMessage(message, event, room, senderTag) {
    this.eventByMessageId.set(message.id, { event, roomId: room.roomId, senderTag });
    if (senderTag === this.currentProfile?.matrixUserId) {
      const recipient = room.getMembers().find((member) => member.userId !== senderTag);
      const recipientTag = recipient?.userId;
      if (recipientTag) this.callbacks.onOwnMessageReceived?.({ message, recipientTag, matrixEvent: event });
      return;
    }
    const onMessageReceived = this.callbacks.onMessageReceived || this.callbacks.onReceiveMessage;
    onMessageReceived?.({
      message,
      senderTag,
      senderInfo: { tag: senderTag, username: senderTag?.split(':')[0]?.slice(1) },
      matrixEvent: event,
    });
    this.callbacks.onMessageStatusUpdate?.({ messageId: message.id, status: 'delivered' });
  }

  async getDirectRoom(peerId) {
    const cached = this.roomByPeer.get(peerId);
    if (cached && this.client.getRoom(cached)) return this.ensureRoomEncryption(cached);
    const directContent = this.client.getAccountData('m.direct')?.getContent?.() || {};
    for (const roomId of directContent[peerId] || []) {
      if (this.client.getRoom(roomId)) {
        this.roomByPeer.set(peerId, roomId);
        return this.ensureRoomEncryption(roomId);
      }
    }
    const room = await this.client.createRoom({
      invite: [peerId],
      is_direct: true,
      name: peerId,
      preset: 'trusted_private_chat',
      initial_state: [{
        type: 'm.room.encryption',
        state_key: '',
        content: { algorithm: 'm.megolm.v1.aes-sha2' },
      }],
    });
    this.roomByPeer.set(peerId, room.room_id);
    const updatedDirectRooms = { ...directContent, [peerId]: [...new Set([...(directContent[peerId] || []), room.room_id])] };
    await this.client.setAccountData('m.direct', updatedDirectRooms);
    return this.ensureRoomEncryption(room.room_id);
  }

  async ensureRoomEncryption(roomId) {
    const room = this.client.getRoom(roomId);
    if (!room) throw new Error('The Matrix room is not available yet.');
    if (!room.hasEncryptionStateEvent()) {
      await this.client.sendStateEvent(roomId, 'm.room.encryption', { algorithm: 'm.megolm.v1.aes-sha2' }, '');
    }
    if (!this.client.getRoom(roomId)?.hasEncryptionStateEvent()) throw new Error('Could not enable Matrix encryption for this room.');
    return roomId;
  }

  sendMessage(recipientTag, message) {
    if (!this.client || !this.isConnected) {
      this.saveToOutbox(recipientTag, message);
      return false;
    }
    this.sendEncryptedMessage(recipientTag, message).catch((error) => {
      this.callbacks.onMessageRejected?.({ messageId: message?.id, error: this.describeError(error) });
    });
    return true;
  }

  async sendEncryptedMessage(recipientTag, message) {
    const peerId = String(recipientTag || '');
    if (!/^@[A-Za-z0-9._=/-]+:[A-Za-z0-9.-]+(?::\d+)?$/.test(peerId)) throw new Error('Choose a registered Matrix user before sending.');
    const roomId = await this.getDirectRoom(peerId);
    const messagePayload = { ...message };
    const attachmentData = message.file?.data || message.mediaUrl || message.audioUrl;
    if (typeof attachmentData === 'string' && /^(data:|blob:)/.test(attachmentData)) {
      const sourceBlob = await fetch(attachmentData).then((response) => response.blob());
      const { data, info } = await this.encryptAttachment(await sourceBlob.arrayBuffer());
      const encryptedUpload = await this.client.uploadContent(new Blob([data], { type: 'application/octet-stream' }), {
        includeFilename: false,
        type: 'application/octet-stream',
      });
      messagePayload.encryptedFile = {
        url: encryptedUpload.content_uri,
        info,
        contentType: sourceBlob.type || message.file?.type || 'application/octet-stream',
      };
      messagePayload.file = message.file ? { ...message.file, data: null, url: null } : null;
      messagePayload.mediaUrl = null;
      messagePayload.audioUrl = null;
    }
    const content = { msgtype: 'm.text', body: JSON.stringify(messagePayload) };
    const response = await this.client.sendEvent(roomId, CHAT_EVENT_TYPE, content);
    if (message?.id) this.eventByMessageId.set(message.id, { eventId: response.event_id, roomId, senderTag: peerId });
    this.callbacks.onMessageStatusUpdate?.({ messageId: message?.id, status: 'delivered' });
  }

  async searchUsers(query, callback) {
    try {
      const result = await this.client.searchUserDirectory({ term: String(query || '').trim().replace(/^@/, ''), limit: 20 });
      const matches = (result?.results || []).map((user) => ({
        id: user.user_id,
        tag: user.user_id,
        username: user.display_name || user.user_id.split(':')[0].slice(1),
        avatar: user.avatar_url ? this.client.mxcUrlToHttp(user.avatar_url) : '',
        status: 'offline',
        lastSeen: 'offline',
      }));
      callback?.(matches);
    } catch {
      callback?.([]);
    }
  }

  async emitReadReceipt(messageId) {
    const item = this.eventByMessageId.get(messageId);
    if (item?.event) await this.client.sendReadReceipt(item.event);
  }

  emitDeliveryReceipt(messageId) { this.emitReadReceipt(messageId); }

  emitTyping(recipientTag, isTyping) {
    const roomId = this.roomByPeer.get(recipientTag);
    if (roomId) this.client.sendTyping(roomId, Boolean(isTyping), isTyping ? 5000 : 1000).catch(() => {});
  }

  async emitReaction(messageId, _recipientTag, emoji) {
    const item = this.eventByMessageId.get(messageId);
    const eventId = item?.event?.getId?.() || item?.eventId;
    if (item?.roomId && eventId) {
      await this.client.sendEvent(item.roomId, 'm.reaction', {
        'm.relates_to': { rel_type: 'm.annotation', event_id: eventId, key: emoji },
      });
    }
  }

  async emitMessageDelete(messageId) {
    const item = this.eventByMessageId.get(messageId);
    const eventId = item?.event?.getId?.() || item?.eventId;
    if (item?.roomId && eventId) await this.client.redactEvent(item.roomId, eventId);
  }

  emitMessageViewed(messageId) { this.emitReadReceipt(messageId); }
  emitMessageShredded(messageId) { this.emitMessageDelete(messageId); }

  emit(event, data, callback) {
    if (event === 'update_profile') {
      this.client?.setDisplayName(data?.customStatus || this.currentProfile?.username).then(() => callback?.({ success: true })).catch((error) => callback?.({ success: false, error: this.describeError(error) }));
    }
  }

  async logoutSession() {
    const client = this.client;
    try { await client?.logout(); } catch { /* Local logout still completes if the homeserver is unavailable. */ }
    this.disconnect();
  }

  disconnect() {
    this.isConnected = false;
    this.started = false;
    this.cryptoReady = false;
    this.cryptoPromise = null;
    this.client?.stopClient();
    this.client = null;
    this.currentProfile = null;
    this.roomByPeer.clear();
    this.eventByMessageId.clear();
  }

  describeError(error) {
    const message = String(error?.data?.error || error?.message || 'Homeserver request failed.');
    if (/M_FORBIDDEN|M_UNKNOWN_TOKEN|invalid username|invalid password/i.test(message)) return 'Sign-in failed. Check the username and password.';
    if (/M_USER_IN_USE|already in use/i.test(message)) return 'That username is already registered on this homeserver.';
    if (/M_REGISTRATION_DISABLED/i.test(message)) return 'This homeserver has disabled public registration.';
    return message.slice(0, 240);
  }

  getOutboxStorageKey() {
    const tag = this.currentProfile?.tag || 'anonymous';
    return `account_${String(tag).toLowerCase().replace(/[^a-z0-9_@.-]/g, '_')}_offline_outbox`;
  }
  async getOutbox() {
    const outbox = await loadDurableData(this.getOutboxStorageKey(), []);
    return Array.isArray(outbox) ? outbox : [];
  }
  async saveToOutbox(recipientTag, message) {
    const queue = await this.getOutbox();
    await saveDurableData(this.getOutboxStorageKey(), [...queue.filter((item) => item.id !== message.id), { id: message.id, recipientTag, message, savedAt: Date.now() }]);
  }
  async removeFromOutbox(messageId) {
    await saveDurableData(this.getOutboxStorageKey(), (await this.getOutbox()).filter((item) => item.id !== messageId));
  }

  async flushOutbox() {
    for (const item of await this.getOutbox()) {
      try {
        await this.sendEncryptedMessage(item.recipientTag, item.message);
        await this.removeFromOutbox(item.id);
        this.callbacks.onOutboxMessageDispatched?.(item.recipientTag, item.message);
      } catch (error) {
        this.callbacks.onMessageRejected?.({ messageId: item.id, error: this.describeError(error) });
      }
    }
  }
}

export const socketService = new MatrixChatService();
