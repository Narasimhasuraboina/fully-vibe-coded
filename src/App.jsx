import React, { useState, useEffect, useCallback, useRef } from 'react';
import './App.css';
import { THEMES } from './themes';
import { 
  INITIAL_CONTACTS, 
  INITIAL_MESSAGES, 
  INITIAL_STORIES, 
  INITIAL_AUTO_REPLIES, 
  INITIAL_SCHEDULED, 
  DEFAULT_GB_SETTINGS 
} from './services/mockData';
import { loadState, saveState } from './services/storage';
import { soundFX } from './services/audioService';
import { socketService } from './services/socketService';
import { notificationService } from './services/notificationService';

// Components
import LoginScreen from './components/LoginScreen';
import TopBar from './components/TopBar';
import Sidebar from './components/Sidebar';
import ChatArea from './components/ChatArea';
import MatrixBackground from './components/MatrixBackground';
import StatusViewerModal from './components/StatusViewerModal';
import DirectChatModal from './components/DirectChatModal';
import BroadcastModal from './components/BroadcastModal';
import ScheduleModal from './components/ScheduleModal';
import LockModal from './components/LockModal';
import ProfileModal from './components/ProfileModal';
import SearchUserModal from './components/SearchUserModal';
import MediaViewerModal from './components/MediaViewerModal';
import MediaGalleryModal from './components/MediaGalleryModal';
import EncryptionModal from './components/EncryptionModal';
import ForwardModal from './components/ForwardModal';
import ToastNotification from './components/ToastNotification';
import { Trash2, X } from 'lucide-react';

function createMessageObject(payload, isUser = true, hideSecondTick = false) {
  const timeNow = Date.now();
  const randSuffix = Math.random().toString(36).substring(2, 6);
  return {
    id: payload.id || `m_${timeNow}_${randSuffix}`,
    sender: isUser ? 'user' : payload.sender,
    text: payload.text || '',
    type: payload.type || 'text',
    mediaUrl: payload.mediaUrl || null,
    code: payload.code,
    language: payload.language,
    fileName: payload.fileName,
    fileSize: payload.fileSize,
    checksum: payload.checksum,
    audioDuration: payload.audioDuration,
    audioWaveform: payload.audioWaveform,
    replyTo: payload.replyTo,
    timestamp: payload.timestamp || new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    status: hideSecondTick ? 'sent' : 'delivered',
    createdAt: timeNow,
    burnAfterRead: payload.burnAfterRead ?? true, // Auto-delete on read
    burnCountdown: payload.burnCountdown ?? null,
    isOutboxPending: payload.isOutboxPending ?? false,
    isQueuedInServerMailbox: payload.isQueuedInServerMailbox ?? false,
  };
}

function App() {
  // Current User Identity (Login Required)
  const [myProfile, setMyProfile] = useState(() => loadState('my_profile', null));
  const [isRealtimeConnected, setIsRealtimeConnected] = useState(false);
  const [serverInfo, setServerInfo] = useState(null);

  // State Initialization
  const [contacts, setContacts] = useState(() => loadState('contacts', INITIAL_CONTACTS));
  const [messages, setMessages] = useState(() => loadState('messages', INITIAL_MESSAGES));
  const [stories] = useState(() => loadState('stories', INITIAL_STORIES));
  const [autoReplies] = useState(() => loadState('auto_replies', INITIAL_AUTO_REPLIES));
  const [scheduledMessages, setScheduledMessages] = useState(() => loadState('scheduled', INITIAL_SCHEDULED));
  const [gbSettings, setGbSettings] = useState(() => loadState('gb_settings', DEFAULT_GB_SETTINGS));
  const [theme, setTheme] = useState(() => gbSettings.theme || 'matrix');

  // Active Context State (Mobile starts at contact list if screen is small)
  const [activeContactId, setActiveContactId] = useState(() => {
    if (typeof window !== 'undefined' && window.innerWidth < 768) {
      return null;
    }
    const savedContacts = loadState('contacts', INITIAL_CONTACTS);
    return savedContacts[0]?.id || null;
  });
  const [typingStatus, setTypingStatus] = useState({}); // { [contactId]: boolean }

  // Modals & Panels
  const [isAppLocked, setIsAppLocked] = useState(false);
  const [isSecretUnlocked, setIsSecretUnlocked] = useState(false);
  const [showSecretUnlockModal, setShowSecretUnlockModal] = useState(false);

  // Enhanced Media & Feature Modals
  const [activeStoryId, setActiveStoryId] = useState(null);
  const [showDirectChatModal, setShowDirectChatModal] = useState(false);
  const [showBroadcastModal, setShowBroadcastModal] = useState(false);
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [showSearchUserModal, setShowSearchUserModal] = useState(false);
  const [mediaViewerItem, setMediaViewerItem] = useState(null);
  const [mediaVaultContact, setMediaVaultContact] = useState(null);
  const [encryptionModalContact, setEncryptionModalContact] = useState(null);
  const [forwardingMessage, setForwardingMessage] = useState(null);
  const [contactToDelete, setContactToDelete] = useState(null);

  // References for Real-time event handlers
  const activeContactRef = useRef(activeContactId);
  const contactsRef = useRef(contacts);

  useEffect(() => {
    activeContactRef.current = activeContactId;
    contactsRef.current = contacts;
  }, [activeContactId, contacts]);

  // Request browser notification permission once logged in
  useEffect(() => {
    if (myProfile) {
      notificationService.requestPermission();
    }
  }, [myProfile]);

  // Sync state to LocalStorage
  useEffect(() => saveState('my_profile', myProfile), [myProfile]);
  useEffect(() => saveState('contacts', contacts), [contacts]);
  useEffect(() => saveState('messages', messages), [messages]);
  useEffect(() => saveState('stories', stories), [stories]);
  useEffect(() => saveState('auto_replies', autoReplies), [autoReplies]);
  useEffect(() => saveState('scheduled', scheduledMessages), [scheduledMessages]);
  useEffect(() => saveState('gb_settings', gbSettings), [gbSettings]);

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

  // Active Contact Object (null when user is viewing contacts matrix on mobile)
  const activeContact = activeContactId ? (contacts.find((c) => c.id === activeContactId) || null) : null;

  // Contact Selection Handler (Triggers View-Once Burn on unread messages)
  const handleSelectContact = (contact) => {
    if (!contact) return;

    setContacts((prev) => {
      const exists = prev.some(
        (item) => item.id === contact.id || (contact.tag && item.tag?.toLowerCase() === contact.tag.toLowerCase())
      );
      if (exists) {
        return prev.map((item) =>
          (item.id === contact.id || (contact.tag && item.tag?.toLowerCase() === contact.tag.toLowerCase()))
            ? { ...item, ...contact, unreadCount: 0 }
            : item
        );
      }
      // Add newly selected/discovered contact into contacts list
      return [contact, ...prev];
    });

    setActiveContactId(contact.id);

    setMessages((prev) => {
      const thread = prev[contact.id] || [];
      let modified = false;
      const updated = thread.map((m) => {
        if (m.sender !== 'user' && (m.burnCountdown === null || m.burnCountdown === undefined)) {
          modified = true;
          socketService.emitMessageViewed(m.id, contact.tag, 10);
          return { ...m, status: 'read', burnCountdown: 10 };
        }
        return m;
      });
      return modified ? { ...prev, [contact.id]: updated } : prev;
    });
  };

  // Burn / Shred Message Handler (Completely deletes from state & storage)
  const handleBurnShredMessage = useCallback((messageId, targetContactId = activeContactId) => {
    setMessages((prev) => {
      const updated = { ...prev };
      let found = false;
      Object.keys(updated).forEach((cId) => {
        if (updated[cId].some((m) => m.id === messageId)) {
          found = true;
          updated[cId] = updated[cId].filter((m) => m.id !== messageId);
        }
      });
      return found ? updated : prev;
    });

    const target = contactsRef.current.find(c => c.id === targetContactId) || contactsRef.current[0];
    if (target) {
      socketService.emitMessageShredded(messageId, target.tag);
    }
  }, [activeContactId]);

  // Real-time Message Reception Handler
  const handleIncomingSocketMessage = useCallback((payload) => {
    const { message, senderInfo } = payload;
    if (!message) return;
    soundFX.playReceived();

    const senderUsername = senderInfo?.username || 'Peer';
    const cleanSenderTag = (senderInfo?.tag || `@${senderUsername}`).toLowerCase().trim();
    const cleanSenderUser = senderUsername.toLowerCase().trim().replace(/^@/, '');

    // Check if sender exists in contacts (case-insensitive match)
    let senderContact = contactsRef.current.find((c) => 
      (c.tag && c.tag.toLowerCase().trim() === cleanSenderTag) || 
      (c.name && c.name.toLowerCase().trim() === cleanSenderUser) ||
      (c.id && (c.id === `peer_${cleanSenderUser}` || c.id.toLowerCase() === cleanSenderTag))
    );
    let targetContactId = senderContact?.id;

    const isCurrentlyViewing = Boolean(
      activeContactRef.current &&
      (activeContactRef.current === targetContactId ||
       (senderContact && (activeContactRef.current === senderContact.id || (senderContact.tag && activeContactRef.current.toLowerCase() === senderContact.tag.toLowerCase()))))
    );

    if (!senderContact) {
      targetContactId = `peer_${cleanSenderUser || Date.now()}`;
      senderContact = {
        id: targetContactId,
        name: senderUsername,
        tag: senderInfo?.tag || `@${cleanSenderUser}`,
        avatar: senderInfo?.avatar || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&auto=format&fit=crop&q=80',
        status: 'online',
        lastSeen: 'online',
        ip: senderInfo?.ip || '10.0.0.x',
        pgp: 'PGP-4096-SEC',
        unreadCount: isCurrentlyViewing ? 0 : 1,
        pinned: false,
        isSecret: false,
        disappearingTimer: 0,
        customStatus: senderInfo?.customStatus || 'Encrypted Peer Node',
      };
      setContacts((prev) => [senderContact, ...prev]);
    } else {
      setContacts((prev) =>
        prev.map((c) => {
          if (c.id === senderContact.id || (c.tag && c.tag.toLowerCase() === cleanSenderTag)) {
            return {
              ...c,
              name: senderUsername || c.name,
              avatar: senderInfo?.avatar || c.avatar,
              status: 'online',
              lastSeen: 'online',
              unreadCount: isCurrentlyViewing ? 0 : (c.unreadCount || 0) + 1,
            };
          }
          return c;
        })
      );
    }

    const incomingMsg = {
      ...message,
      sender: 'contact',
      burnCountdown: isCurrentlyViewing ? 10 : null,
      status: isCurrentlyViewing ? 'read' : 'delivered',
    };

    if (isCurrentlyViewing) {
      socketService.emitMessageViewed(incomingMsg.id, senderContact.tag, 10);
    }

    setMessages((prev) => ({
      ...prev,
      [targetContactId]: [...(prev[targetContactId] || []), incomingMsg],
    }));

    notificationService.pushToast({
      title: `MESSAGE FROM ${senderContact.name.toUpperCase()}`,
      message: message.text || (message.type === 'image' ? '📸 Sent an encrypted image' : '📁 Sent an attachment'),
      type: 'message',
    });

    if (!isCurrentlyViewing) {
      notificationService.showDesktopNotification(`Message from ${senderContact.name}`, {
        body: message.text || 'Encrypted payload received',
        icon: senderContact.avatar,
      });
    }
  }, []);

  // Global Disappearing Messages Burn Countdown Engine (Pauses when tab is hidden)
  useEffect(() => {
    const interval = setInterval(() => {
      if (document.hidden) return;

      setMessages((prev) => {
        let hasChanges = false;
        const nextState = { ...prev };

        Object.keys(nextState).forEach((contactId) => {
          const thread = nextState[contactId];
          const updatedThread = [];

          thread.forEach((msg) => {
            if (msg.burnCountdown !== null && msg.burnCountdown !== undefined) {
              hasChanges = true;
              const nextCountdown = msg.burnCountdown - 1;
              if (nextCountdown > 0) {
                updatedThread.push({ ...msg, burnCountdown: nextCountdown });
              } else {
                // Countdown reached zero -> Shred message completely
                handleBurnShredMessage(msg.id, contactId);
              }
            } else {
              updatedThread.push(msg);
            }
          });

          nextState[contactId] = updatedThread;
        });

        return hasChanges ? nextState : prev;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [handleBurnShredMessage]);

  // Connect to Real-time Socket.io Relay
  useEffect(() => {
    if (!myProfile) return;

    socketService.connect(myProfile, {
      onConnect: () => setIsRealtimeConnected(true),
      onDisconnect: () => setIsRealtimeConnected(false),
      onRegistered: (data) => setServerInfo(data),
      
      // Update online status of known contacts from directory
      onPeersUpdate: (peers) => {
        setContacts((prev) => {
          return prev.map((contact) => {
            const peer = peers.find(p => p.tag === contact.tag);
            if (peer) {
              return {
                ...contact,
                status: peer.status,
                lastSeen: peer.lastSeen,
                ip: peer.ip,
                avatar: peer.avatar || contact.avatar,
              };
            }
            return contact;
          });
        });
      },

      // When peer comes online -> update status & flush outbox
      onPeerOnline: (peer) => {
        soundFX.playKeypress();
        const peerTag = peer.tag?.toLowerCase()?.trim();
        setContacts((prev) =>
          prev.map((c) => (c.tag?.toLowerCase()?.trim() === peerTag ? { ...c, status: 'online', lastSeen: 'online', avatar: peer.avatar || c.avatar } : c))
        );
      },

      // When peer goes offline
      onPeerOffline: (data) => {
        const peerTag = data.tag?.toLowerCase()?.trim();
        setContacts((prev) =>
          prev.map((c) => (c.tag?.toLowerCase()?.trim() === peerTag ? { ...c, status: 'offline', lastSeen: data.lastSeen } : c))
        );
      },

      onReceiveMessage: handleIncomingSocketMessage,

      onMessageDelivered: ({ messageId, recipientTag }) => {
        const cleanTag = recipientTag?.toLowerCase()?.trim();
        setMessages((prev) => {
          const target = contactsRef.current.find((c) => c.tag?.toLowerCase()?.trim() === cleanTag);
          if (!target || !prev[target.id]) return prev;
          const updated = prev[target.id].map((m) =>
            m.id === messageId ? { ...m, status: 'delivered', isOutboxPending: false, isQueuedInServerMailbox: false } : m
          );
          return { ...prev, [target.id]: updated };
        });
      },

      // Message securely deposited in Server Store-and-Forward Mailbox
      onMessageQueuedInServerMailbox: ({ messageId, recipientTag }) => {
        const cleanTag = recipientTag?.toLowerCase()?.trim();
        setMessages((prev) => {
          const target = contactsRef.current.find((c) => c.tag?.toLowerCase()?.trim() === cleanTag);
          if (!target || !prev[target.id]) return prev;
          const updated = prev[target.id].map((m) =>
            m.id === messageId ? { ...m, isQueuedInServerMailbox: true, isOutboxPending: false, status: 'queued_server' } : m
          );
          return { ...prev, [target.id]: updated };
        });
      },

      // When user logs in and server mailbox delivers offline messages
      onMailboxDeliveredSummary: ({ count }) => {
        soundFX.playReceived();
        notificationService.pushToast({
          title: 'OFFLINE STORE-AND-FORWARD MAILBOX',
          message: `Retrieved ${count} encrypted message(s) queued while you were offline!`,
          type: 'success',
        });
      },

      // When peer was offline, message saved in sender outbox / server mailbox
      onPeerOfflineAck: ({ messageId, recipientTag }) => {
        const cleanTag = recipientTag?.toLowerCase()?.trim();
        setMessages((prev) => {
          const target = contactsRef.current.find((c) => c.tag?.toLowerCase()?.trim() === cleanTag);
          if (!target || !prev[target.id]) return prev;
          const updated = prev[target.id].map((m) =>
            m.id === messageId ? { ...m, isQueuedInServerMailbox: true, isOutboxPending: false } : m
          );
          return { ...prev, [target.id]: updated };
        });
      },

      // Peer viewed message -> start 10s burn countdown on sender side too
      onMessageViewedByPeer: ({ messageId, burnDelay = 10 }) => {
        setMessages((prev) => {
          const updated = { ...prev };
          let found = false;
          Object.keys(updated).forEach((cId) => {
            updated[cId] = updated[cId].map((m) => {
              if (m.id === messageId) {
                found = true;
                return { ...m, status: 'read', burnCountdown: burnDelay || 10 };
              }
              return m;
            });
          });
          return found ? updated : prev;
        });
      },

      onMessageShredded: ({ messageId }) => {
        setMessages((prev) => {
          const updated = { ...prev };
          Object.keys(updated).forEach((cId) => {
            updated[cId] = updated[cId].filter((m) => m.id !== messageId);
          });
          return updated;
        });
      },

      onPeerTyping: ({ senderTag, isTyping }) => {
        const cleanTag = senderTag?.toLowerCase()?.trim();
        const contact = contactsRef.current.find((c) => c.tag?.toLowerCase()?.trim() === cleanTag);
        if (contact) {
          setTypingStatus((prev) => ({ ...prev, [contact.id]: isTyping }));
        }
      },

      onOutboxMessageDispatched: (peerTag, msg) => {
        const cleanTag = peerTag?.toLowerCase()?.trim();
        setMessages((prev) => {
          const target = contactsRef.current.find((c) => c.tag?.toLowerCase()?.trim() === cleanTag);
          if (!target || !prev[target.id]) return prev;
          const updated = prev[target.id].map((m) =>
            m.id === msg.id ? { ...m, isOutboxPending: false, status: 'delivered' } : m
          );
          return { ...prev, [target.id]: updated };
        });
      },
    });
  }, [myProfile, handleIncomingSocketMessage]);

  // Add / Start Chat with Discovered User
  const handleSelectAndAddContact = (userContact) => {
    const cleanTag = userContact.tag?.toLowerCase()?.trim();
    const existing = contacts.find(c => c.tag?.toLowerCase()?.trim() === cleanTag);
    if (existing) {
      handleSelectContact(existing);
      return;
    }

    const newContact = {
      id: userContact.id || `peer_${userContact.username.toLowerCase()}`,
      name: userContact.username,
      tag: userContact.tag,
      avatar: userContact.avatar,
      status: userContact.status || 'offline',
      lastSeen: userContact.lastSeen || 'offline',
      ip: userContact.ip || '10.0.0.x',
      pgp: 'PGP-4096-NET',
      unreadCount: 0,
      pinned: false,
      isSecret: false,
      disappearingTimer: 0,
      customStatus: userContact.customStatus || 'Discovered via Network Search',
      bio: 'Verified network contact',
    };

    setContacts((prev) => [newContact, ...prev]);
    setActiveContactId(newContact.id);
  };

  // Initiate Delete Contact Confirmation
  const handleInitiateDeleteContact = (contactId) => {
    const target = contacts.find(c => c.id === contactId);
    if (target) {
      setContactToDelete(target);
    }
  };

  // Confirm Delete Contact Purge
  const handleConfirmDeleteContact = () => {
    if (!contactToDelete) return;
    const targetId = contactToDelete.id;

    soundFX.playGlitchAlarm();

    // 1. Remove from contacts
    setContacts(prev => prev.filter(c => c.id !== targetId));

    // 2. Remove all messages and conversation history
    setMessages(prev => {
      const copy = { ...prev };
      delete copy[targetId];
      return copy;
    });

    // 3. Clear typing status
    setTypingStatus(prev => {
      const copy = { ...prev };
      delete copy[targetId];
      return copy;
    });

    // 4. If current active contact was deleted, reset to another contact or null
    if (activeContactId === targetId) {
      const remaining = contacts.filter(c => c.id !== targetId);
      if (typeof window !== 'undefined' && window.innerWidth < 768) {
        setActiveContactId(null);
      } else {
        setActiveContactId(remaining[0]?.id || null);
      }
    }

    notificationService.pushToast({
      title: 'CONTACT PURGED',
      message: `Node @${contactToDelete.name} and conversation records permanently deleted from this device.`,
      type: 'warning',
    });

    setContactToDelete(null);
  };

  // Logout Handler
  const handleLogout = () => {
    setMyProfile(null);
    localStorage.removeItem('chatforge_my_profile');
    setIsRealtimeConnected(false);
  };

  // Send Message Handler
  const handleSendMessage = (messagePayload, customTargetId = null) => {
    const targetId = customTargetId || activeContactId;
    if (!targetId) return;

    soundFX.playSent();

    const targetContact = contacts.find((c) => c.id === targetId);
    if (!targetContact) return;

    const recipientTag = targetContact.tag || (targetContact.name ? `@${targetContact.name.replace(/^@/, '')}` : null);
    if (!recipientTag) return;

    const newMsg = createMessageObject(
      messagePayload,
      true,
      gbSettings.hideBlueTicks
    );

    // 1. Update Sender's Local UI State Immediately
    setMessages((prev) => ({
      ...prev,
      [targetId]: [...(prev[targetId] || []), newMsg],
    }));

    // 2. Dispatch via Real-time Socket (Always attempt real-time transmission)
    const sent = socketService.sendMessage(recipientTag, newMsg);
    if (!sent) {
      // Local client itself is disconnected / offline
      socketService.saveToOutbox(recipientTag, newMsg);
    }

    // 3. Reset unread count for target
    setContacts((prev) =>
      prev.map((c) => (c.id === targetId ? { ...c, unreadCount: 0 } : c))
    );

    // 4. Auto-Reply Trigger Evaluation (GB Mod Simulation)
    if (targetContact.isAutoReply) {
      setTimeout(() => {
        const matchingRule = autoReplies.find(
          (rule) =>
            rule.enabled &&
            (rule.type === 'exact'
              ? (messagePayload.text || '').toLowerCase() === rule.trigger.toLowerCase()
              : (messagePayload.text || '').toLowerCase().includes(rule.trigger.toLowerCase()))
        );

        const responseText = matchingRule
          ? matchingRule.response
          : `[AUTO-REPLY]: Operator is currently in stealth mode. Payload logged.`;

        const autoMsg = createMessageObject(
          { text: responseText },
          false
        );

        setMessages((prev) => ({
          ...prev,
          [targetId]: [...(prev[targetId] || []), autoMsg],
        }));
        soundFX.playReceived();
      }, 1200);
    }
  };

  // Message Reaction Handler
  const handleReactMessage = (messageId, emoji) => {
    if (!activeContact) return;
    soundFX.playKeypress();

    setMessages((prev) => {
      const thread = prev[activeContact.id] || [];
      const updated = thread.map((m) => {
        if (m.id === messageId) {
          const reactions = m.reactions || [];
          return {
            ...m,
            reactions: reactions.includes(emoji)
              ? reactions.filter((r) => r !== emoji)
              : [...reactions, emoji],
          };
        }
        return m;
      });
      return { ...prev, [activeContact.id]: updated };
    });
  };

  // Delete for Everyone (Revoke Simulation)
  const handleDeleteForEveryone = (messageId) => {
    if (!activeContact) return;
    setMessages((prev) => {
      const thread = prev[activeContact.id] || [];
      const updated = thread.map((m) => {
        if (m.id === messageId) {
          return {
            ...m,
            isDeletedBySender: true,
            deletedAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          };
        }
        return m;
      });
      return { ...prev, [activeContact.id]: updated };
    });
  };

  // Delete for Me
  const handleDeleteForMe = (messageId) => {
    if (!activeContact) return;
    setMessages((prev) => ({
      ...prev,
      [activeContact.id]: (prev[activeContact.id] || []).filter((m) => m.id !== messageId),
    }));
  };

  // Clear Chat Thread
  const handleClearThread = (contactId) => {
    setMessages((prev) => ({ ...prev, [contactId]: [] }));
  };

  // Pin / Unpin Contact
  const handleTogglePinContact = (contactId) => {
    setContacts((prev) =>
      prev.map((c) => (c.id === contactId ? { ...c, pinned: !c.pinned } : c))
    );
  };

  // Update Contact Disappearing Timer
  const handleUpdateContactDisappearing = (contactId, seconds) => {
    setContacts((prev) =>
      prev.map((c) => (c.id === contactId ? { ...c, disappearingTimer: seconds } : c))
    );
  };

  // Direct Message to Unsaved Username / IP
  const handleStartDirectChat = (targetUsernameOrIp, initialMessage) => {
    const cleanTag = `@${targetUsernameOrIp.trim().replace(/^@/, '').toLowerCase()}`;
    const existing = contacts.find((c) => c.tag === cleanTag || c.name.toLowerCase() === targetUsernameOrIp.toLowerCase());
    
    if (existing) {
      handleSelectContact(existing);
      if (initialMessage) handleSendMessage({ text: initialMessage }, existing.id);
      return;
    }

    const newContactId = `user_${Date.now()}`;
    const newContact = {
      id: newContactId,
      name: targetUsernameOrIp.replace(/^@/, ''),
      tag: cleanTag,
      avatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&auto=format&fit=crop&q=80',
      status: 'offline',
      lastSeen: 'offline',
      ip: '192.168.1.x',
      pgp: 'PGP-4096-DIRECT-RAW',
      unreadCount: 0,
      pinned: false,
      isSecret: false,
      disappearingTimer: 0,
      customStatus: 'Direct unindexed mesh connection.',
      bio: 'Direct peer connection created via username dispatch.',
    };

    setContacts((prev) => [newContact, ...prev]);
    setActiveContactId(newContactId);

    if (initialMessage) {
      setTimeout(() => {
        handleSendMessage({ text: initialMessage }, newContactId);
      }, 200);
    }
  };

  // Broadcast Message to Selected Contacts
  const handleBroadcastMessage = (broadcastText, targetIds = null) => {
    const targets = targetIds || contacts.map((c) => c.id);
    targets.forEach((cId) => {
      handleSendMessage({ text: `[BROADCAST]: ${broadcastText}` }, cId);
    });
  };

  // Forward Message
  const handleForwardMessage = (targetContactIds) => {
    if (!forwardingMessage) return;
    targetContactIds.forEach((cId) => {
      const fwdPayload = {
        ...forwardingMessage,
        id: `fwd_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        replyTo: null,
      };
      handleSendMessage(fwdPayload, cId);
    });
    setForwardingMessage(null);
  };

  // IF USER IS NOT LOGGED IN -> RENDER TERMINAL LOGIN GATEWAY FIRST
  if (!myProfile) {
    return (
      <div className={`chatforge-app-root ${gbSettings.scanlinesEnabled ? 'crt-scanlines' : ''}`}>
        <MatrixBackground enabled={true} color={THEMES[theme]?.accent || '#00ff66'} />
        <LoginScreen onLogin={(prof) => setMyProfile(prof)} serverInfo={serverInfo} />
      </div>
    );
  }

  return (
    <div className={`chatforge-app-root ${gbSettings.scanlinesEnabled ? 'crt-scanlines' : ''}`}>
      
      {/* Toast Notification Container */}
      <ToastNotification />

      {/* Background Cyber Effect */}
      <MatrixBackground enabled={gbSettings.matrixRainBg} color={THEMES[theme]?.accent || '#00ff66'} />

      {/* Top Header Bar */}
      <TopBar 
        theme={theme}
        setTheme={setTheme}
        gbSettings={gbSettings}
        setGbSettings={setGbSettings}
        onLockApp={() => setIsAppLocked(true)}
        myProfile={myProfile}
        onOpenProfile={() => setShowProfileModal(true)}
        onLogout={handleLogout}
        isRealtimeConnected={isRealtimeConnected}
      />

      {/* Main Split Layout */}
      <div className={`chatforge-main-layout ${activeContact ? 'has-active-chat' : 'no-active-chat'}`}>
        
        {/* Left Sidebar */}
        <Sidebar
          contacts={contacts}
          activeContact={activeContact}
          onSelectContact={handleSelectContact}
          onDeleteContact={handleInitiateDeleteContact}
          messages={messages}
          typingStatus={typingStatus}
          stories={stories}
          onOpenStory={(storyId) => {
            soundFX.playKeypress();
            setActiveStoryId(storyId);
          }}
          onOpenSearchUsers={() => setShowSearchUserModal(true)}
          onOpenBroadcast={() => setShowBroadcastModal(true)}
          onOpenSchedule={() => setShowScheduleModal(true)}
          gbSettings={gbSettings}
          onTogglePinContact={handleTogglePinContact}
          onUnlockSecretChats={() => setShowSecretUnlockModal(true)}
          isSecretUnlocked={isSecretUnlocked}
        />

        {/* Central Chat Area */}
        <ChatArea
          activeContact={activeContact}
          messages={messages}
          onSendMessage={handleSendMessage}
          onReactMessage={handleReactMessage}
          onDeleteForEveryone={handleDeleteForEveryone}
          onDeleteForMe={handleDeleteForMe}
          onUpdateContactDisappearing={handleUpdateContactDisappearing}
          onBurnShredMessage={handleBurnShredMessage}
          onOpenEncryptionModal={(c) => setEncryptionModalContact(c)}
          onOpenMediaVault={(c) => setMediaVaultContact(c)}
          onOpenMediaViewer={(m) => setMediaViewerItem(m)}
          onForwardMessage={(m) => setForwardingMessage(m)}
          onDeleteContact={handleInitiateDeleteContact}
          isTyping={typingStatus[activeContact?.id]}
          gbSettings={gbSettings}
          onClearThread={handleClearThread}
          onBack={() => setActiveContactId(null)}
        />

      </div>

      {/* MODALS */}
      {/* 1. App Master Lock */}
      {isAppLocked && (
        <LockModal
          mode="app_lock"
          correctPin={gbSettings.appPin || '1337'}
          onUnlock={() => setIsAppLocked(false)}
        />
      )}

      {/* 2. Secret Chats PIN Unlock */}
      {showSecretUnlockModal && (
        <LockModal
          mode="secret_chat"
          correctPin={gbSettings.secretChatPin || '0000'}
          onUnlock={() => {
            setIsSecretUnlocked(true);
            setShowSecretUnlockModal(false);
          }}
          onClose={() => setShowSecretUnlockModal(false)}
        />
      )}

      {/* 3. Full-Screen Photo & Video Media Viewer / Lightbox */}
      {mediaViewerItem && (
        <MediaViewerModal
          media={mediaViewerItem}
          onClose={() => setMediaViewerItem(null)}
          onBurnShred={(msgId) => handleBurnShredMessage(msgId)}
        />
      )}

      {/* 4. Media & Payload Vault Drawer */}
      {mediaVaultContact && (
        <MediaGalleryModal
          contact={mediaVaultContact}
          messages={messages[mediaVaultContact.id] || []}
          onClose={() => setMediaVaultContact(null)}
          onOpenMedia={(item) => setMediaViewerItem(item)}
        />
      )}

      {/* 5. E2EE Security & Safety Number Matrix Inspector */}
      {encryptionModalContact && (
        <EncryptionModal
          myProfile={myProfile}
          contact={encryptionModalContact}
          onClose={() => setEncryptionModalContact(null)}
        />
      )}

      {/* 6. Message Forwarding Modal */}
      {forwardingMessage && (
        <ForwardModal
          message={forwardingMessage}
          contacts={contacts}
          onClose={() => setForwardingMessage(null)}
          onForwardMessage={handleForwardMessage}
        />
      )}

      {/* 7. Status / Story Viewer */}
      {activeStoryId && (
        <StatusViewerModal
          stories={stories}
          initialStoryId={activeStoryId}
          onClose={() => setActiveStoryId(null)}
          onReplyToStatus={(cId, txt) => handleSendMessage({ text: txt }, cId)}
          gbSettings={gbSettings}
        />
      )}

      {/* 8. Direct Message to Unsaved Username/IP */}
      {showDirectChatModal && (
        <DirectChatModal
          onClose={() => setShowDirectChatModal(false)}
          onStartDirectChat={handleStartDirectChat}
        />
      )}

      {/* 9. Mass Message Broadcast Blaster */}
      {showBroadcastModal && (
        <BroadcastModal
          contacts={contacts}
          onClose={() => setShowBroadcastModal(false)}
          onBroadcastMessage={handleBroadcastMessage}
        />
      )}

      {/* 10. Message Scheduler */}
      {showScheduleModal && (
        <ScheduleModal
          contacts={contacts}
          activeContact={activeContact}
          onClose={() => setShowScheduleModal(false)}
          onScheduleMessage={(sched) => setScheduledMessages((prev) => [...prev, sched])}
        />
      )}

      {/* 11. Operator Profile & Multi-Device Pairing */}
      {showProfileModal && (
        <ProfileModal
          currentProfile={myProfile}
          onSaveProfile={(newProf) => {
            setMyProfile(newProf);
            socketService.connect(newProf);
          }}
          onClose={() => setShowProfileModal(false)}
          serverInfo={serverInfo}
        />
      )}

      {/* 12. Global Username Search Modal */}
      {showSearchUserModal && (
        <SearchUserModal
          currentProfile={myProfile}
          existingContacts={contacts}
          onSelectAndAddContact={handleSelectAndAddContact}
          onClose={() => setShowSearchUserModal(false)}
        />
      )}

      {/* 13. Delete Contact Confirmation Modal */}
      {contactToDelete && (
        <div className="modal-backdrop" onClick={() => setContactToDelete(null)}>
          <div className="cyber-modal delete-contact-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-title text-danger">
                <Trash2 size={16} className="text-danger" />
                <span>TERMINATE FREQUENCY // PURGE CONTACT</span>
              </div>
              <button className="btn-close" onClick={() => setContactToDelete(null)}>
                <X size={16} />
              </button>
            </div>

            <div className="modal-body">
              <div className="delete-contact-preview">
                <img src={contactToDelete.avatar} alt={contactToDelete.name} className="delete-avatar" />
                <div className="delete-info">
                  <span className="delete-name">{contactToDelete.name}</span>
                  <span className="delete-tag">{contactToDelete.tag}</span>
                </div>
              </div>

              <p className="delete-warning-text">
                Are you sure you want to remove <strong>@{contactToDelete.name}</strong> from your screen?
                All local conversation logs, unread counts, and session state for this node will be purged from this device.
              </p>

              <div className="modal-footer-actions">
                <button
                  type="button"
                  className="cyber-btn btn-secondary"
                  onClick={() => setContactToDelete(null)}
                >
                  CANCEL
                </button>
                <button
                  type="button"
                  className="cyber-btn btn-danger"
                  onClick={handleConfirmDeleteContact}
                >
                  <Trash2 size={14} />
                  <span>PURGE FROM TERMINAL</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

export default App;
