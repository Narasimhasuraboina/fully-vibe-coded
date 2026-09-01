import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { ChatContext } from './ChatContextInstance';
import { THEMES } from '../themes';
import { socketService } from '../services/socketService';
import { soundFX } from '../services/audioService';
import { notificationService } from '../services/notificationService';
import { loadState, saveState, loadAccountState, saveAccountState } from '../services/storage';

const DEFAULT_GB_SETTINGS = {
  soundEffects: true,
  hideBlueTicks: false,
  theme: 'matrix',
};

export const ChatProvider = ({ children }) => {
  // 1. Current Authenticated Profile
  const [currentUser, setCurrentUser] = useState(() => loadState('my_profile', null));

  // 2. Settings & Theme
  const [settings, setSettings] = useState(() => 
    currentUser ? loadAccountState(currentUser, 'gb_settings', DEFAULT_GB_SETTINGS) : DEFAULT_GB_SETTINGS
  );
  const [theme, setThemeState] = useState(() => settings.theme || 'matrix');

  // 3. Socket & Network Status
  const [isConnected, setIsConnected] = useState(false);
  const [serverInfo, setServerInfo] = useState({ localIP: '127.0.0.1', port: 3001 });

  // 4. Contacts & Active Conversation
  const [contacts, setContacts] = useState(() => 
    currentUser ? loadAccountState(currentUser, 'contacts', []) : []
  );
  const [activeContactId, setActiveContactId] = useState(null);

  // 5. Messages Store: { [contactId]: [Message] }
  const [messages, setMessages] = useState(() => 
    currentUser ? loadAccountState(currentUser, 'messages', {}) : {}
  );

  // 6. Scheduled Messages Store
  const [scheduledMessages, setScheduledMessages] = useState(() => 
    currentUser ? loadAccountState(currentUser, 'scheduled', []) : []
  );

  // 7. Modal Management
  const [activeModal, setActiveModal] = useState(null); // 'broadcast' | 'schedule' | 'encryption' | 'gallery' | 'mediaViewer' | 'forward' | 'profile'
  const [modalData, setModalData] = useState(null);

  // 8. UI Transients
  const [typingStatus, setTypingStatus] = useState({}); // { [contactId]: boolean }
  const [searchQuery, setSearchQuery] = useState('');

  // Refs for real-time socket listeners
  const activeContactRef = useRef(activeContactId);
  const contactsRef = useRef(contacts);
  const currentUserRef = useRef(currentUser);

  useEffect(() => {
    activeContactRef.current = activeContactId;
  }, [activeContactId]);

  useEffect(() => {
    contactsRef.current = contacts;
  }, [contacts]);

  useEffect(() => {
    currentUserRef.current = currentUser;
  }, [currentUser]);

  // Apply Theme CSS variables dynamically
  useEffect(() => {
    const currentTheme = THEMES[theme] || THEMES.matrix;
    const root = document.documentElement;
    root.style.setProperty('--bg-main', currentTheme.bg);
    root.style.setProperty('--bg-card', currentTheme.bgCard);
    root.style.setProperty('--bg-card-hover', currentTheme.bgCardHover);
    root.style.setProperty('--bg-header', currentTheme.bgHeader);
    root.style.setProperty('--accent', currentTheme.accent);
    root.style.setProperty('--accent-glow', currentTheme.accentGlow);
    root.style.setProperty('--accent-light', currentTheme.accentLight);
    root.style.setProperty('--text-main', currentTheme.textMain);
    root.style.setProperty('--text-muted', currentTheme.textMuted);
    root.style.setProperty('--border', currentTheme.border);
    root.style.setProperty('--border-active', currentTheme.borderActive);
    root.style.setProperty('--user-bubble', currentTheme.userBubble);
    root.style.setProperty('--contact-bubble', currentTheme.contactBubble);
    root.style.setProperty('--badge', currentTheme.badge);
    root.style.setProperty('--badge-text', currentTheme.badgeText);
    root.style.setProperty('--danger', currentTheme.danger);
    root.style.setProperty('--font-main', currentTheme.font);
  }, [theme]);

  // Sync state to account-isolated LocalStorage
  useEffect(() => {
    saveState('my_profile', currentUser);
  }, [currentUser]);

  useEffect(() => {
    if (currentUser) {
      saveAccountState(currentUser, 'contacts', contacts);
    }
  }, [contacts, currentUser]);

  useEffect(() => {
    if (currentUser) {
      saveAccountState(currentUser, 'messages', messages);
    }
  }, [messages, currentUser]);

  useEffect(() => {
    if (currentUser) {
      saveAccountState(currentUser, 'scheduled', scheduledMessages);
    }
  }, [scheduledMessages, currentUser]);

  useEffect(() => {
    if (currentUser) {
      saveAccountState(currentUser, 'gb_settings', settings);
    }
  }, [settings, currentUser]);

  // Theme Setter
  const setTheme = (newTheme) => {
    if (!THEMES[newTheme]) return;
    setThemeState(newTheme);
    setSettings((prev) => ({ ...prev, theme: newTheme }));
  };

  // Modal Open/Close Helpers
  const openModal = useCallback((modalName, data = null) => {
    setActiveModal(modalName);
    setModalData(data);
  }, []);

  const closeModal = useCallback(() => {
    setActiveModal(null);
    setModalData(null);
  }, []);

  // Active Contact Object
  const activeContact = useMemo(() => {
    if (!activeContactId) return null;
    return contacts.find((c) => c.id === activeContactId) || null;
  }, [activeContactId, contacts]);

  // Switch Active Contact
  const selectContact = useCallback((contactOrId) => {
    if (!contactOrId) {
      setActiveContactId(null);
      return;
    }
    const id = typeof contactOrId === 'string' ? contactOrId : contactOrId.id;
    setActiveContactId(id);

    // Reset unread count for this contact
    setContacts((prev) =>
      prev.map((c) => (c.id === id ? { ...c, unreadCount: 0 } : c))
    );
  }, []);

  // Ensure contact exists or create direct chat
  const addOrSelectContact = useCallback((peer) => {
    if (!peer) return;
    const cleanTag = peer.tag?.startsWith('@') ? peer.tag : `@${peer.tag || peer.username}`;
    const contactId = peer.id || `peer_${cleanTag.replace(/^@/, '').toLowerCase()}`;

    setContacts((prev) => {
      const existing = prev.find((c) => c.tag?.toLowerCase() === cleanTag.toLowerCase());
      if (existing) {
        return prev.map((c) => (c.id === existing.id ? { ...c, status: peer.status || c.status } : c));
      }
      const newContact = {
        id: contactId,
        name: peer.username || peer.name || cleanTag.replace(/^@/, ''),
        tag: cleanTag,
        avatar: peer.avatar || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&auto=format&fit=crop&q=80',
        status: peer.status || 'online',
        lastSeen: peer.lastSeen || 'online',
        unreadCount: 0,
        disappearingTimer: 0,
        pinned: false,
        isSecret: false,
      };
      return [newContact, ...prev];
    });

    setActiveContactId(contactId);
  }, []);

  // Initialize Socket connection and listeners
  const setupSocketListeners = useCallback(() => {
    socketService.setListeners({
      onConnect: () => {
        setIsConnected(true);
      },
      onDisconnect: () => {
        setIsConnected(false);
      },
      onRegistered: (data) => {
        setIsConnected(true);
        if (data.localIP) {
          setServerInfo((prev) => ({ ...prev, localIP: data.localIP }));
        }
      },
      onPeerOnline: (data) => {
        const { peer } = data;
        setContacts((prev) =>
          prev.map((c) =>
            c.tag?.toLowerCase() === peer.tag?.toLowerCase()
              ? { ...c, status: 'online', lastSeen: 'online' }
              : c
          )
        );
      },
      onPeerOffline: (data) => {
        const { peerTag, lastSeen } = data;
        setContacts((prev) =>
          prev.map((c) =>
            c.tag?.toLowerCase() === peerTag?.toLowerCase()
              ? { ...c, status: 'offline', lastSeen: lastSeen || 'offline' }
              : c
          )
        );
      },
      onMessageReceived: (data) => {
        const { message, senderTag } = data;
        soundFX.playReceived();

        // Ensure contact exists
        const currentContacts = contactsRef.current;
        let matchedContact = currentContacts.find(
          (c) => c.tag?.toLowerCase() === senderTag?.toLowerCase()
        );

        let contactId;
        if (!matchedContact) {
          const rawName = senderTag.replace(/^@/, '');
          contactId = `peer_${rawName.toLowerCase()}`;
          const newContact = {
            id: contactId,
            name: rawName,
            tag: senderTag,
            avatar: message.senderAvatar || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&auto=format&fit=crop&q=80',
            status: 'online',
            lastSeen: 'online',
            unreadCount: activeContactRef.current === contactId ? 0 : 1,
            disappearingTimer: 0,
            pinned: false,
          };
          setContacts((prev) => [newContact, ...prev]);
        } else {
          contactId = matchedContact.id;
          setContacts((prev) =>
            prev.map((c) =>
              c.id === contactId
                ? {
                    ...c,
                    unreadCount: activeContactRef.current === contactId ? 0 : (c.unreadCount || 0) + 1,
                  }
                : c
            )
          );
        }

        // Add message to conversation
        setMessages((prev) => {
          const existingList = prev[contactId] || [];
          if (existingList.some((m) => m.id === message.id)) return prev;
          return {
            ...prev,
            [contactId]: [...existingList, message],
          };
        });

        // Trigger in-app toast notification & desktop alert
        const previewText = message.text || (message.file ? `[Attachment: ${message.file.name}]` : 'Encrypted Signal');
        notificationService.pushToast({
          title: `INCOMING SIGNAL // ${senderTag}`,
          message: previewText,
          avatar: message.senderAvatar,
          type: 'info',
          onClick: () => selectContact(contactId),
        });
        notificationService.showDesktopNotification(`Signal from ${senderTag}`, {
          body: previewText,
        });

        // Send delivery receipt back to sender
        socketService.emitDeliveryReceipt(message.id, senderTag);
      },
      onMessageStatusUpdate: (data) => {
        const { messageId, status } = data;
        setMessages((prev) => {
          let hasChanged = false;
          const next = { ...prev };
          Object.keys(next).forEach((cId) => {
            const list = next[cId];
            const idx = list.findIndex((m) => m.id === messageId);
            if (idx !== -1 && list[idx].status !== status) {
              const updatedList = [...list];
              updatedList[idx] = { ...updatedList[idx], status };
              next[cId] = updatedList;
              hasChanged = true;
            }
          });
          return hasChanged ? next : prev;
        });
      },
      onTyping: (data) => {
        const { senderTag, isTyping } = data;
        const matched = contactsRef.current.find(
          (c) => c.tag?.toLowerCase() === senderTag?.toLowerCase()
        );
        if (matched) {
          setTypingStatus((prev) => ({ ...prev, [matched.id]: isTyping }));
        }
      },
      onMessageDeleted: (data) => {
        const { messageId } = data;
        setMessages((prev) => {
          let changed = false;
          const next = { ...prev };
          Object.keys(next).forEach((cId) => {
            const list = next[cId];
            if (list.some((m) => m.id === messageId)) {
              next[cId] = list.map((m) =>
                m.id === messageId ? { ...m, deleted: true, text: 'This message was deleted' } : m
              );
              changed = true;
            }
          });
          return changed ? next : prev;
        });
      },
      onMessageShredded: (data) => {
        const { messageId } = data;
        setMessages((prev) => {
          let changed = false;
          const next = { ...prev };
          Object.keys(next).forEach((cId) => {
            const list = next[cId];
            if (list.some((m) => m.id === messageId)) {
              next[cId] = list.filter((m) => m.id !== messageId);
              changed = true;
            }
          });
          return changed ? next : prev;
        });
      },
    });
  }, [selectContact]);

  // Connect socket on mount or when user changes
  useEffect(() => {
    if (currentUser) {
      setupSocketListeners();
      socketService.connect(currentUser);
    } else {
      socketService.disconnect();
    }
  }, [currentUser, setupSocketListeners]);

  // Auth: Login / Register
  const login = (profile) => {
    setCurrentUser(profile);
    const loadedContacts = loadAccountState(profile, 'contacts', []);
    const loadedMessages = loadAccountState(profile, 'messages', {});
    const loadedSettings = loadAccountState(profile, 'gb_settings', DEFAULT_GB_SETTINGS);
    const loadedScheduled = loadAccountState(profile, 'scheduled', []);

    setContacts(loadedContacts);
    setMessages(loadedMessages);
    setScheduledMessages(loadedScheduled);
    setSettings(loadedSettings);
    setThemeState(loadedSettings.theme || 'matrix');
    setActiveContactId(loadedContacts[0]?.id || null);
    setupSocketListeners();
    socketService.connect(profile);
  };

  // Auth: Logout
  const logout = () => {
    socketService.disconnect();
    setCurrentUser(null);
    setActiveContactId(null);
    setContacts([]);
    setMessages({});
    setScheduledMessages([]);
    setIsConnected(false);
    localStorage.removeItem('chatforge_my_profile');
  };

  // Send Message
  const sendMessage = useCallback((payload, targetContactId = null) => {
    const targetId = targetContactId || activeContactId;
    if (!targetId || !currentUser) return;

    const targetContact = contacts.find((c) => c.id === targetId);
    if (!targetContact) return;

    const newMsg = {
      id: `msg_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      sender: 'user',
      senderTag: currentUser.tag,
      senderAvatar: currentUser.avatar,
      recipientTag: targetContact.tag,
      text: payload.text || '',
      type: payload.type || 'text',
      file: payload.file || null,
      audioUrl: payload.audioUrl || null,
      mediaUrl: payload.mediaUrl || payload.file?.data || payload.file?.url || null,
      code: payload.code || null,
      language: payload.language || null,
      fileName: payload.fileName || payload.file?.name || null,
      fileSize: payload.fileSize || payload.file?.size || null,
      audioDuration: payload.audioDuration || null,
      replyTo: payload.replyTo || null,
      burnAfterRead: payload.burnAfterRead || false,
      burnCountdown: payload.burnCountdown || null,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      status: 'sent',
      reactions: {},
    };

    soundFX.playSent();

    // Optimistically update message feed
    setMessages((prev) => ({
      ...prev,
      [targetId]: [...(prev[targetId] || []), newMsg],
    }));

    // Move contact to top of list
    setContacts((prev) => {
      const existing = prev.find((c) => c.id === targetId);
      const remaining = prev.filter((c) => c.id !== targetId);
      return existing ? [existing, ...remaining] : prev;
    });

    // Relay over Socket.io
    socketService.sendMessage(targetContact.tag, newMsg);
  }, [activeContactId, currentUser, contacts]);

  // Mass Broadcast Blaster
  const broadcastMessage = useCallback((text, targetContactIds) => {
    if (!text || !targetContactIds || targetContactIds.length === 0) return;
    targetContactIds.forEach((cId) => {
      sendMessage({ text, type: 'text' }, cId);
    });
    notificationService.pushToast({
      title: 'BROADCAST DISPATCHED',
      message: `Mass broadcast sent to ${targetContactIds.length} recipient node(s).`,
      type: 'success',
    });
  }, [sendMessage]);

  // Forward Encrypted Message
  const forwardMessage = useCallback((targetContactIds = [], customTag = '') => {
    if (!modalData) return;
    const msg = modalData;
    const cleanPayload = {
      text: msg.text,
      type: msg.type || 'text',
      file: msg.file,
      audioUrl: msg.audioUrl,
      mediaUrl: msg.mediaUrl,
      code: msg.code,
      language: msg.language,
      fileName: msg.fileName,
      fileSize: msg.fileSize,
    };

    targetContactIds.forEach((cId) => {
      sendMessage(cleanPayload, cId);
    });

    if (customTag && customTag.trim()) {
      const cleanCustom = customTag.trim().startsWith('@') ? customTag.trim() : `@${customTag.trim()}`;
      let contact = contacts.find((c) => c.tag?.toLowerCase() === cleanCustom.toLowerCase());
      if (!contact) {
        contact = {
          id: `peer_${cleanCustom.replace(/^@/, '').toLowerCase()}`,
          name: cleanCustom.replace(/^@/, ''),
          tag: cleanCustom,
          avatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&auto=format&fit=crop&q=80',
          status: 'offline',
          lastSeen: 'offline',
          unreadCount: 0,
        };
        setContacts((prev) => [contact, ...prev]);
      }
      sendMessage(cleanPayload, contact.id);
    }

    notificationService.pushToast({
      title: 'PAYLOAD FORWARDED',
      message: `Forwarded to ${targetContactIds.length + (customTag ? 1 : 0)} destination node(s).`,
      type: 'success',
    });
  }, [modalData, contacts, sendMessage]);

  // Schedule Message
  const scheduleMessage = useCallback((item) => {
    setScheduledMessages((prev) => [...prev, item]);
    notificationService.pushToast({
      title: 'TRANSMISSION QUEUED',
      message: `Scheduled for ${item.scheduledTime} to ${item.contactName}`,
      type: 'info',
    });
  }, []);

  const deleteScheduledMessage = useCallback((id) => {
    setScheduledMessages((prev) => prev.filter((s) => s.id !== id));
  }, []);

  // Background Dispatcher for Scheduled Messages (checks every 1s)
  useEffect(() => {
    if (!currentUser || scheduledMessages.length === 0) return;
    const interval = setInterval(() => {
      const now = new Date();
      const localHHMM = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
      const utcHHMM = `${String(now.getUTCHours()).padStart(2, '0')}:${String(now.getUTCMinutes()).padStart(2, '0')}`;

      setScheduledMessages((prev) => {
        let hasDispatched = false;
        const updated = prev.map((item) => {
          if (item.status === 'pending' && (item.scheduledTime === localHHMM || item.scheduledTime === utcHHMM)) {
            hasDispatched = true;
            sendMessage({ text: item.message, type: 'text' }, item.contactId);
            notificationService.pushToast({
              title: 'SCHEDULE DISPATCHED',
              message: `Auto-delivered scheduled transmission to ${item.contactName || 'Node'}`,
              type: 'success',
            });
            return { ...item, status: 'dispatched' };
          }
          return item;
        });
        return hasDispatched ? updated : prev;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [currentUser, scheduledMessages, sendMessage]);

  // React to Message
  const reactMessage = useCallback((messageId, emoji) => {
    if (!activeContactId) return;
    setMessages((prev) => {
      const currentList = prev[activeContactId] || [];
      const updated = currentList.map((m) => {
        if (m.id === messageId) {
          const reactions = { ...(m.reactions || {}) };
          reactions[emoji] = (reactions[emoji] || 0) + 1;
          return { ...m, reactions };
        }
        return m;
      });
      return { ...prev, [activeContactId]: updated };
    });
  }, [activeContactId]);

  // Delete message
  const deleteMessage = useCallback((messageId, forEveryone = false) => {
    if (!activeContactId) return;
    const targetContact = contacts.find((c) => c.id === activeContactId);

    setMessages((prev) => {
      const currentList = prev[activeContactId] || [];
      const updated = currentList.map((m) => {
        if (m.id === messageId) {
          return { ...m, deleted: true, text: 'This message was deleted' };
        }
        return m;
      });
      return { ...prev, [activeContactId]: updated };
    });

    if (forEveryone && targetContact) {
      socketService.emitMessageDelete(messageId, targetContact.tag);
    }
  }, [activeContactId, contacts]);

  // Shred / Burn Message
  const shredMessage = useCallback((messageId) => {
    if (!activeContactId) return;
    const targetContact = contacts.find((c) => c.id === activeContactId);
    soundFX.playGlitchAlarm();

    setMessages((prev) => {
      const currentList = prev[activeContactId] || [];
      return {
        ...prev,
        [activeContactId]: currentList.filter((m) => m.id !== messageId),
      };
    });

    if (targetContact) {
      socketService.emitMessageShred(messageId, targetContact.tag);
    }
  }, [activeContactId, contacts]);

  // Clear thread
  const clearChat = useCallback((contactId) => {
    const id = contactId || activeContactId;
    if (!id) return;
    setMessages((prev) => ({ ...prev, [id]: [] }));
  }, [activeContactId]);

  // Update Profile
  const updateProfile = useCallback((updatedProfile) => {
    setCurrentUser(updatedProfile);
    saveState('my_profile', updatedProfile);
    if (isConnected) {
      socketService.emit('update_profile', {
        avatar: updatedProfile.avatar,
        customStatus: updatedProfile.customStatus,
      });
    }
    notificationService.pushToast({
      title: 'PROFILE UPDATED',
      message: 'Operator identity and status synced across mesh.',
      type: 'success',
    });
  }, [isConnected]);

  // Emit typing indicator
  const emitTyping = useCallback((isTyping) => {
    if (activeContact && currentUser) {
      socketService.emitTyping(activeContact.tag, isTyping);
    }
  }, [activeContact, currentUser]);

  const value = {
    currentUser,
    login,
    logout,
    theme,
    setTheme,
    isConnected,
    serverInfo,
    contacts,
    setContacts,
    activeContactId,
    activeContact,
    selectContact,
    addOrSelectContact,
    messages: messages[activeContactId] || [],
    allMessages: messages,
    scheduledMessages,
    scheduleMessage,
    deleteScheduledMessage,
    broadcastMessage,
    forwardMessage,
    updateProfile,
    shredMessage,
    sendMessage,
    reactMessage,
    deleteMessage,
    clearChat,
    typingStatus: activeContact ? !!typingStatus[activeContact.id] : false,
    emitTyping,
    searchQuery,
    setSearchQuery,
    activeModal,
    modalData,
    openModal,
    closeModal,
  };

  return <ChatContext.Provider value={value}>{children}</ChatContext.Provider>;
};
