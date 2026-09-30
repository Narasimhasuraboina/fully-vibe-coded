import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { ChatContext } from './ChatContextInstance';
import { THEMES } from '../themes';
import { socketService } from '../services/socketService';
import { soundFX } from '../services/audioService';
import { notificationService } from '../services/notificationService';
import { accountId, getContactId, loadDurableData, loadState, saveDurableData, saveState, loadAccountState, saveAccountState } from '../services/storage';
import { DEFAULT_AVATAR } from '../avatars';

const DEFAULT_GB_SETTINGS = {
  soundEffects: false,
  hideBlueTicks: false,
  theme: 'matrix',
};

function formatDisappearingTime(sec) {
  if (!sec) return 'Off';
  if (sec < 60) return `${sec}s`;
  if (sec < 3600) return `${Math.floor(sec / 60)}m`;
  return `${Math.floor(sec / 3600)}h`;
}

export const ChatProvider = ({ children }) => {
  // 1. Current Authenticated Profile
  const [currentUser, setCurrentUser] = useState(() => {
    const saved = loadState('my_profile', null);
    if (!saved || typeof saved !== 'object' || !saved.sessionToken || (!saved.tag && !saved.matrixUserId)) {
      if (saved?.password) saveState('my_profile', null);
      return null;
    }
    const { password: _password, ...safeProfile } = saved;
    return safeProfile;
  });

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
    currentUser ? loadAccountState(currentUser, 'contacts', []).filter((contact) => /^@[A-Za-z0-9._=/-]+(:[A-Za-z0-9.-]+(?::\d+)?)?$/.test(contact?.tag || '')) : []
  );
  const [activeContactId, setActiveContactId] = useState(null);

  // 5. Messages Store: { [contactId]: [Message] }
  const [messages, setMessages] = useState({});
  const messagesAccountRef = useRef(null);
  const currentUserAccountId = accountId(currentUser);

  // 6. Scheduled Messages Store
  const [scheduledMessages, setScheduledMessages] = useState(() => 
    currentUser ? loadAccountState(currentUser, 'scheduled', []) : []
  );

  // 7. Modal Management
  const [activeModal, setActiveModal] = useState(null); // 'broadcast' | 'schedule' | 'encryption' | 'gallery' | 'mediaViewer' | 'forward' | 'profile'
  const [modalData, setModalData] = useState(null);

  // 8. Pinned Messages Store: { [contactId]: [messageId, ...] }
  const [pinnedMessageIds, setPinnedMessageIds] = useState(() =>
    currentUser ? loadAccountState(currentUser, 'pinned_messages', {}) : {}
  );

  // 9. In-Chat Message Search
  const [isChatSearchOpen, setIsChatSearchOpen] = useState(false);
  const [chatSearchQuery, setChatSearchQuery] = useState('');

  // 10. Audio Mute State
  const [isSoundMuted, setIsSoundMuted] = useState(() => soundFX.isMuted());

  // 11. UI Transients
  const [typingStatus, setTypingStatus] = useState({}); // { [contactId]: boolean }
  const [searchQuery, setSearchQuery] = useState('');
  const typingTimersRef = useRef({});

  // Refs for real-time socket listeners
  const activeContactRef = useRef(activeContactId);
  const contactsRef = useRef(contacts);
  const currentUserRef = useRef(currentUser);

  useEffect(() => {
    let cancelled = false;
    messagesAccountRef.current = null;
    if (!currentUserAccountId) {
      return undefined;
    }
    loadDurableData(`account_${currentUserAccountId}_messages`, {}).then((savedMessages) => {
      if (cancelled) return;
      setMessages(savedMessages && typeof savedMessages === 'object' ? savedMessages : {});
      messagesAccountRef.current = currentUserAccountId;
    });
    return () => { cancelled = true; };
  }, [currentUserAccountId]);

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
      socketService.syncAccountState(contacts, settings);
    }
  }, [contacts, currentUser, settings]);

  useEffect(() => {
    if (currentUserAccountId && messagesAccountRef.current === currentUserAccountId) {
      saveDurableData(`account_${currentUserAccountId}_messages`, messages);
    }
  }, [messages, currentUserAccountId]);

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

  useEffect(() => {
    if (currentUser) {
      saveAccountState(currentUser, 'pinned_messages', pinnedMessageIds);
    }
  }, [pinnedMessageIds, currentUser]);

  const toggleSoundMute = useCallback(() => {
    const next = soundFX.toggleMute();
    setIsSoundMuted(next);
    return next;
  }, []);

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

  // Read Receipts: Mark incoming messages from contact as read
  const markMessagesAsRead = useCallback((targetContactId) => {
    if (!targetContactId) return;
    setMessages((prev) => {
      const currentList = prev[targetContactId] || [];
      let changed = false;
      const updated = currentList.map((m) => {
        if (m.sender !== 'user' && m.status !== 'read') {
          changed = true;
          if (m.senderTag) {
            socketService.emitReadReceipt(m.id, m.senderTag);
          }
          return { ...m, status: 'read' };
        }
        return m;
      });
      return changed ? { ...prev, [targetContactId]: updated } : prev;
    });
  }, []);

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

    markMessagesAsRead(id);
  }, [markMessagesAsRead]);

  // Ensure contact exists or create direct chat
  const addOrSelectContact = useCallback((peer) => {
    if (!peer) return;
    const cleanTag = peer.tag?.startsWith('@') ? peer.tag : `@${peer.tag || peer.username}`;
    const contactId = peer.id || getContactId(cleanTag);

    setContacts((prev) => {
      const existing = prev.find((c) => c.tag?.toLowerCase() === cleanTag.toLowerCase());
      if (existing) {
        return prev.map((c) => (c.id === existing.id ? { ...c, status: peer.status || c.status } : c));
      }
      const newContact = {
        id: contactId,
        name: peer.username || peer.name || cleanTag.replace(/^@/, '').split(':')[0],
        tag: cleanTag,
        avatar: peer.avatar || DEFAULT_AVATAR,
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

  // Remove contact from list
  const removeContact = useCallback((contactId) => {
    if (!contactId) return;
    setContacts((prev) => prev.filter((c) => c.id !== contactId));
    setActiveContactId((current) => (current === contactId ? null : current));
    notificationService.pushToast({
      title: 'CONTACT REMOVED',
      message: 'Operator removed from node frequency list.',
      type: 'info',
    });
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
          setServerInfo((prev) => ({ ...prev, localIP: data.localIP, port: data.port || prev.port }));
        }
      },
      onProfileUpdated: (profile) => {
        if (profile?.tag === currentUserRef.current?.tag || profile?.id === currentUserRef.current?.id) setCurrentUser(profile);
      },
      onForceLogout: (data) => {
        soundFX.playGlitchAlarm();
        notificationService.pushToast({
          title: 'SESSION TERMINATED',
          message: data?.reason || 'You were logged out because this account was logged into on another device.',
          type: 'warning',
        });
        socketService.logoutSession();
        setCurrentUser(null);
        setActiveContactId(null);
        setContacts([]);
        setMessages({});
        setScheduledMessages([]);
        setPinnedMessageIds({});
        setIsConnected(false);
        localStorage.removeItem('chatforge_my_profile');
        saveState('my_profile', null);
      },
      onAccountSynced: (data) => {
        if (data.contacts && Array.isArray(data.contacts) && data.contacts.length > 0) {
          setContacts((prev) => {
            const map = new Map();
            data.contacts.forEach((c) => { if (c?.id && c?.tag) map.set(c.id, c); });
            prev.forEach((c) => { if (c?.id && c?.tag && !map.has(c.id)) map.set(c.id, c); });
            return Array.from(map.values());
          });
        }
        if (data.settings && typeof data.settings === 'object') {
          setSettings((prev) => ({ ...prev, ...data.settings }));
          if (data.settings.theme) setThemeState(data.settings.theme);
        }
      },
      onSessionExpired: () => {
        setIsConnected(false);
        notificationService.pushToast({
          title: 'SIGN IN REQUIRED',
          message: 'Your secure session expired. Please sign in again.',
          type: 'warning',
        });
        setCurrentUser(null);
        setMessages({});
        messagesAccountRef.current = null;
        saveState('my_profile', null);
      },
      onPeersUpdate: (peers) => {
        if (!Array.isArray(peers)) return;
        const peerMap = new Map();
        peers.forEach((p) => {
          if (p?.tag) peerMap.set(p.tag.toLowerCase(), p);
        });
        setContacts((prev) =>
          prev.map((c) => {
            const peer = peerMap.get(c.tag?.toLowerCase());
            if (!peer) return c;
            return {
              ...c,
              status: peer.status || c.status,
              lastSeen: peer.lastSeen || c.lastSeen,
              customStatus: peer.customStatus || c.customStatus,
              avatar: peer.avatar || c.avatar,
            };
          })
        );
      },
      onPeerOnline: (data) => {
        const peer = data?.peer || data;
        if (!peer?.tag) return;
        setContacts((prev) =>
          prev.map((c) =>
            c.tag?.toLowerCase() === peer.tag?.toLowerCase()
              ? { ...c, status: 'online', lastSeen: 'online' }
              : c
          )
        );
      },
      onPeerOffline: (data) => {
        const peerTag = data?.peerTag || data?.tag;
        const { lastSeen } = data || {};
        setContacts((prev) =>
          prev.map((c) =>
            c.tag?.toLowerCase() === peerTag?.toLowerCase()
              ? { ...c, status: 'offline', lastSeen: lastSeen || 'offline' }
              : c
          )
        );
      },
      onPeerProfileUpdated: (peer) => {
        if (!peer?.tag) return;
        setContacts((prev) => prev.map((contact) =>
          contact.tag?.toLowerCase() === peer.tag.toLowerCase()
            ? { ...contact, avatar: peer.avatar || contact.avatar, customStatus: peer.customStatus || '' }
            : contact
        ));
      },
      onMessageReceived: (data) => {
        const message = data?.message;
        const senderTag = data?.senderTag || data?.senderInfo?.tag;
        if (!message?.id || !senderTag) return;
        soundFX.playReceived();

        // Ensure contact exists
        const currentContacts = contactsRef.current;
        let matchedContact = currentContacts.find(
          (c) => c.tag?.toLowerCase() === senderTag?.toLowerCase()
        );

        let contactId;
        if (!matchedContact) {
          const rawName = senderTag.replace(/^@/, '').split(':')[0];
          contactId = getContactId(senderTag);
          const newContact = {
            id: contactId,
            name: rawName,
            tag: senderTag,
            avatar: message.senderAvatar || DEFAULT_AVATAR,
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
                    status: 'online',
                    lastSeen: 'online',
                    unreadCount: activeContactRef.current === contactId ? 0 : (c.unreadCount || 0) + 1,
                  }
                : c
            )
          );
        }

        // If incoming message has twoWay burn countdown, ensure local contact record reflects it
        if (message.isTwoWay && message.burnCountdown > 0) {
          setContacts((prev) =>
            prev.map((c) =>
              c.id === contactId
                ? { ...c, status: 'online', lastSeen: 'online', disappearingTimer: message.burnCountdown, isTwoWayDisappearing: true }
                : c
            )
          );
        }

        const isCurrentlyActive = activeContactRef.current === contactId;
        const incomingMsg = {
          ...message,
          sender: 'contact',
          senderTag,
          status: isCurrentlyActive ? 'read' : (message.status || 'delivered'),
        };

        // Add message to conversation
        setMessages((prev) => {
          const existingList = prev[contactId] || [];
          if (existingList.some((m) => m.id === incomingMsg.id)) return prev;
          return {
            ...prev,
            [contactId]: [...existingList, incomingMsg],
          };
        });

        // Trigger in-app toast notification & desktop alert if not actively viewing
        if (!isCurrentlyActive) {
          const previewText = incomingMsg.text || (incomingMsg.file ? `[Attachment: ${incomingMsg.file.name}]` : 'Encrypted Signal');
          notificationService.pushToast({
            title: `INCOMING SIGNAL // ${senderTag}`,
            message: previewText,
            avatar: incomingMsg.senderAvatar,
            type: 'info',
            onClick: () => selectContact(contactId),
          });
          notificationService.showDesktopNotification(`Signal from ${senderTag}`, {
            body: previewText,
          });
        }

        // Send delivery receipt back to sender
        socketService.emitDeliveryReceipt(incomingMsg.id, senderTag);
        if (isCurrentlyActive) {
          socketService.emitReadReceipt(incomingMsg.id, senderTag);
        }
      },
      onOwnMessageReceived: ({ message, recipientTag }) => {
        if (!message?.id || !recipientTag) return;
        const existingContact = contactsRef.current.find((contact) => contact.tag?.toLowerCase() === recipientTag.toLowerCase());
        const contactId = existingContact?.id || getContactId(recipientTag);
        if (!existingContact) {
          const username = recipientTag.split(':')[0].replace(/^@/, '');
          setContacts((prev) => prev.some((contact) => contact.tag?.toLowerCase() === recipientTag.toLowerCase()) ? prev : [{
            id: contactId,
            name: username,
            tag: recipientTag,
            avatar: '',
            status: 'offline',
            lastSeen: 'offline',
            unreadCount: 0,
            disappearingTimer: 0,
            pinned: false,
          }, ...prev]);
        }
        setMessages((prev) => {
          const list = prev[contactId] || [];
          if (list.some((item) => item.id === message.id)) return prev;
          return { ...prev, [contactId]: [...list, { ...message, sender: 'user', senderTag: currentUserRef.current?.tag, status: 'sent' }] };
        });
      },
      onMessageStatusUpdate: (data) => {
        const { messageId, status } = data;
        if (status === 'read') {
          soundFX.playReadTick();
        }
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
      onMessageReacted: (data) => {
        const { messageId, emoji } = data;
        setMessages((prev) => {
          let hasChanged = false;
          const next = { ...prev };
          Object.keys(next).forEach((cId) => {
            const list = next[cId];
            const idx = list.findIndex((m) => m.id === messageId);
            if (idx !== -1) {
              const updatedList = [...list];
              const reactions = { ...(updatedList[idx].reactions || {}) };
              reactions[emoji] = (reactions[emoji] || 0) + 1;
              updatedList[idx] = { ...updatedList[idx], reactions };
              next[cId] = updatedList;
              hasChanged = true;
            }
          });
          return hasChanged ? next : prev;
        });
      },
      onRateLimitExceeded: (data) => {
        notificationService.pushToast({
          title: 'FLOW CONTROL THROTTLED',
          message: data?.error || 'Rate limit active. Please slow down packet transmission.',
          type: 'warning',
        });
      },
      onTyping: (data) => {
        const { senderTag, isTyping } = data;
        const matched = contactsRef.current.find(
          (c) => c.tag?.toLowerCase() === senderTag?.toLowerCase()
        );
        if (matched) {
          const contactId = matched.id;
          setContacts((prev) =>
            prev.map((c) =>
              c.id === contactId && c.status !== 'online'
                ? { ...c, status: 'online', lastSeen: 'online' }
                : c
            )
          );
          if (typingTimersRef.current[contactId]) {
            clearTimeout(typingTimersRef.current[contactId]);
            delete typingTimersRef.current[contactId];
          }

          setTypingStatus((prev) => ({ ...prev, [contactId]: isTyping }));

          if (isTyping) {
            typingTimersRef.current[contactId] = setTimeout(() => {
              setTypingStatus((prev) => ({ ...prev, [contactId]: false }));
            }, 3500);
          }
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
        soundFX.playGlitchAlarm();
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
      onDisappearingTimerSync: (data) => {
        const { senderTag, seconds, isTwoWay } = data || {};
        if (!senderTag) return;
        const sec = Number(seconds) || 0;
        const cleanSender = String(senderTag).toLowerCase().trim();
        const cleanSenderNoAt = cleanSender.replace(/^@/, '');
        const currentContacts = contactsRef.current;
        const matched = currentContacts.find((c) => {
          const cTag = (c.tag || '').toLowerCase().trim();
          return cTag === cleanSender || cTag.replace(/^@/, '') === cleanSenderNoAt;
        });

        const twoWay = isTwoWay && sec > 0;
        let contactId;
        if (!matched) {
          const rawName = cleanSenderNoAt.split(':')[0];
          const standardTag = cleanSender.startsWith('@') ? cleanSender : `@${cleanSender}`;
          contactId = getContactId(standardTag);
          const newContact = {
            id: contactId,
            name: rawName,
            tag: standardTag,
            avatar: DEFAULT_AVATAR,
            status: 'online',
            lastSeen: 'online',
            unreadCount: 0,
            disappearingTimer: isTwoWay ? sec : 0,
            isTwoWayDisappearing: twoWay,
            pinned: false,
          };
          setContacts((prev) => [newContact, ...prev]);
        } else {
          contactId = matched.id;
          setContacts((prev) =>
            prev.map((c) =>
              c.id === contactId
                ? {
                    ...c,
                    status: 'online',
                    lastSeen: 'online',
                    disappearingTimer: isTwoWay ? sec : c.disappearingTimer,
                    isTwoWayDisappearing: twoWay,
                  }
                : c
            )
          );
        }

          const timeLabel = formatDisappearingTime(sec);
          const noticeText = sec > 0
            ? (isTwoWay
                ? `🔥 ${senderTag} enabled Two-Way Disappearing (${timeLabel}). Messages from both operators will auto-shred after being read.`
                : `🔥 ${senderTag} enabled One-Way Disappearing (${timeLabel}) on their outgoing messages.`)
            : `${senderTag} turned off disappearing messages.`;

          const sysMsg = {
            id: `sys_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
            sender: 'system',
            type: 'system',
            isSystem: true,
            text: noticeText,
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          };

          setMessages((prev) => ({
            ...prev,
            [contactId]: [...(prev[contactId] || []), sysMsg],
          }));

          notificationService.pushToast({
            title: sec > 0 ? (isTwoWay ? '🔥 TWO-WAY DISAPPEARING ACTIVATED' : '🔥 DISAPPEARING UPDATED') : 'DISAPPEARING DISABLED',
            message: noticeText,
            type: sec > 0 ? 'warning' : 'info',
          });
        }
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
    const { password: _password, ...safeProfile } = profile;
    setCurrentUser(safeProfile);
    saveState('my_profile', safeProfile);

    // Merge contacts from server with locally cached contacts for new phone login
    const serverContacts = Array.isArray(profile.contacts) ? profile.contacts : [];
    const localContacts = loadAccountState(profile, 'contacts', []);
    const mergedMap = new Map();
    [...serverContacts, ...localContacts].forEach((c) => {
      if (c?.id && c?.tag) mergedMap.set(c.id, c);
    });
    const loadedContacts = Array.from(mergedMap.values());

    const loadedSettings = profile.settings || loadAccountState(profile, 'gb_settings', DEFAULT_GB_SETTINGS);
    const loadedScheduled = loadAccountState(profile, 'scheduled', []);
    const loadedPinned = loadAccountState(profile, 'pinned_messages', {});

    setContacts(loadedContacts);
    messagesAccountRef.current = null;
    setMessages({});
    setScheduledMessages(loadedScheduled);
    setPinnedMessageIds(loadedPinned);
    setSettings(loadedSettings);
    setThemeState(loadedSettings.theme || 'matrix');
    setActiveContactId(loadedContacts[0]?.id || null);
    setActiveModal(null);
    setModalData(null);
    setSearchQuery('');
    setIsChatSearchOpen(false);
    setChatSearchQuery('');
    setupSocketListeners();
    socketService.connect(safeProfile);
  };

  // Auth: Logout
  const logout = () => {
    socketService.logoutSession();
    setCurrentUser(null);
    setActiveContactId(null);
    setContacts([]);
    setMessages({});
    setScheduledMessages([]);
    setPinnedMessageIds({});
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
      mediaUrl: payload.mediaUrl || payload.file?.url || null,
      code: payload.code || null,
      language: payload.language || null,
      fileName: payload.fileName || payload.file?.name || null,
      fileSize: payload.fileSize || payload.file?.size || null,
      audioDuration: payload.audioDuration || null,
      replyTo: payload.replyTo || null,
      burnAfterRead: payload.burnAfterRead || (targetContact.disappearingTimer > 0),
      burnCountdown: payload.burnCountdown || (targetContact.disappearingTimer > 0 ? targetContact.disappearingTimer : null),
      isTwoWay: targetContact.isTwoWayDisappearing ?? (targetContact.disappearingTimer > 0),
      isViewOnce: payload.isViewOnce || false,
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
          id: getContactId(cleanCustom),
          name: cleanCustom.replace(/^@/, '').split(':')[0],
          tag: cleanCustom,
          avatar: DEFAULT_AVATAR,
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

      const toDispatch = scheduledMessages.filter(
        (item) => item.status === 'pending' && (item.scheduledTime === localHHMM || item.scheduledTime === utcHHMM)
      );

      if (toDispatch.length > 0) {
        setScheduledMessages((prev) =>
          prev.map((item) =>
            toDispatch.some((d) => d.id === item.id) ? { ...item, status: 'dispatched' } : item
          )
        );
        toDispatch.forEach((item) => {
          sendMessage({ text: item.message, type: 'text' }, item.contactId);
          notificationService.pushToast({
            title: 'SCHEDULE DISPATCHED',
            message: `Auto-delivered scheduled transmission to ${item.contactName || 'Node'}`,
            type: 'success',
          });
        });
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [currentUser, scheduledMessages, sendMessage]);

  // React to Message
  const reactMessage = useCallback((messageId, emoji) => {
    if (!activeContactId) return;
    const targetContact = contacts.find((c) => c.id === activeContactId);

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

    if (targetContact) {
      socketService.emitReaction(messageId, targetContact.tag, emoji);
    }
  }, [activeContactId, contacts]);

  // Toggle Pin Message
  const togglePinMessage = useCallback((messageId, contactId = null) => {
    const targetId = contactId || activeContactId;
    if (!targetId || !messageId) return;

    soundFX.playPinSound();

    setPinnedMessageIds((prev) => {
      const list = prev[targetId] || [];
      const isPinned = list.includes(messageId);
      const updatedList = isPinned ? list.filter((id) => id !== messageId) : [messageId, ...list];

      notificationService.pushToast({
        title: isPinned ? 'MESSAGE UNPINNED' : 'MESSAGE PINNED',
        message: isPinned ? 'Payload unpinned from conversation header.' : 'Payload pinned to top of conversation.',
        type: 'info',
      });

      return {
        ...prev,
        [targetId]: updatedList,
      };
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

  // Set Contact Ephemeral Disappearing Timer
  const setContactDisappearingTimer = useCallback((contactId, seconds, isTwoWay = true) => {
    const targetId = contactId || activeContactId;
    if (!targetId) return;
    const targetContact = contactsRef.current.find((c) => c.id === targetId || c.tag === targetId);
    const sec = Number(seconds) || 0;
    const twoWay = sec > 0 ? !!isTwoWay : false;

    setContacts((prev) => {
      const updated = prev.map((c) =>
        c.id === targetId || (targetContact && c.tag?.toLowerCase() === targetContact.tag?.toLowerCase())
          ? { ...c, disappearingTimer: sec, isTwoWayDisappearing: twoWay }
          : c
      );
      contactsRef.current = updated;
      return updated;
    });

    // Sync across socket to peer
    if (targetContact?.tag) {
      socketService.emitSetDisappearingTimer(targetContact.tag, sec, twoWay);
    }

    const timeLabel = formatDisappearingTime(sec);
    const noticeText = sec > 0
      ? (twoWay
          ? `🔥 You enabled Two-Way Disappearing (${timeLabel}). Messages from both operators will auto-shred after being read.`
          : `🔥 You enabled One-Way Disappearing (${timeLabel}). Only your outgoing messages will auto-shred after being read.`)
      : 'Disappearing messages turned off. Messages in this frequency are now persistent.';

    // Inject system notification into active conversation thread
    const sysMsg = {
      id: `sys_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      sender: 'system',
      type: 'system',
      isSystem: true,
      text: noticeText,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages((prev) => ({
      ...prev,
      [targetId]: [...(prev[targetId] || []), sysMsg],
    }));

    notificationService.pushToast({
      title: sec > 0 ? (twoWay ? '🔥 TWO-WAY DISAPPEARING ACTIVE' : '🔥 ONE-WAY DISAPPEARING ACTIVE') : 'DISAPPEARING DISABLED',
      message: noticeText,
      type: sec > 0 ? 'warning' : 'info',
    });
  }, [activeContactId]);

  // Shred / Burn Message
  const shredMessage = useCallback((messageId, targetContactId = null) => {
    const contactId = targetContactId || activeContactId;
    if (!contactId) return;
    const targetContact = contacts.find((c) => c.id === contactId);
    soundFX.playGlitchAlarm();

    setMessages((prev) => {
      const currentList = prev[contactId] || [];
      return {
        ...prev,
        [contactId]: currentList.filter((m) => m.id !== messageId),
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
    const { password: _password, ...safeProfile } = updatedProfile;
    setCurrentUser(safeProfile);
    saveState('my_profile', safeProfile);
    if (isConnected) {
      socketService.emit('update_profile', {
        avatar: safeProfile.avatar,
        customStatus: safeProfile.customStatus,
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
    removeContact,
    messages: messages[activeContactId] || [],
    allMessages: messages,
    pinnedMessageIds: activeContactId ? (pinnedMessageIds[activeContactId] || []) : [],
    allPinnedMessageIds: pinnedMessageIds,
    togglePinMessage,
    markMessagesAsRead,
    scheduledMessages,
    scheduleMessage,
    deleteScheduledMessage,
    broadcastMessage,
    forwardMessage,
    updateProfile,
    shredMessage,
    setContactDisappearingTimer,
    sendMessage,
    reactMessage,
    deleteMessage,
    clearChat,
    typingStatus: activeContact ? !!typingStatus[activeContact.id] : false,
    emitTyping,
    searchQuery,
    setSearchQuery,
    isChatSearchOpen,
    setIsChatSearchOpen,
    chatSearchQuery,
    setChatSearchQuery,
    isSoundMuted,
    toggleSoundMute,
    activeModal,
    modalData,
    openModal,
    closeModal,
  };

  return <ChatContext.Provider value={value}>{children}</ChatContext.Provider>;
};
