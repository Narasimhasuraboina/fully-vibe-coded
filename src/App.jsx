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
import HackerInspector from './components/HackerInspector';
import MatrixBackground from './components/MatrixBackground';
import CallModal from './components/CallModal';
import IncomingCallAlert from './components/IncomingCallAlert';
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
    burnAfterRead: payload.burnAfterRead ?? false, // View-Once auto-delete default
    burnCountdown: payload.burnCountdown ?? null,
    isOutboxPending: payload.isOutboxPending ?? false,
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
  const [stories, setStories] = useState(() => loadState('stories', INITIAL_STORIES));
  const [autoReplies, setAutoReplies] = useState(() => loadState('auto_replies', INITIAL_AUTO_REPLIES));
  const [scheduledMessages, setScheduledMessages] = useState(() => loadState('scheduled', INITIAL_SCHEDULED));
  const [gbSettings, setGbSettings] = useState(() => loadState('gb_settings', DEFAULT_GB_SETTINGS));
  const [theme, setTheme] = useState(() => gbSettings.theme || 'matrix');

  // Active Context State
  const [activeContactId, setActiveContactId] = useState(() => contacts[0]?.id || null);
  const [typingStatus, setTypingStatus] = useState({}); // { [contactId]: boolean }

  // Modals & Panels
  const [isInspectorOpen, setIsInspectorOpen] = useState(false);
  const [isAppLocked, setIsAppLocked] = useState(false);
  const [isSecretUnlocked, setIsSecretUnlocked] = useState(false);
  const [showSecretUnlockModal, setShowSecretUnlockModal] = useState(false);
  
  // Real WebRTC Call states
  const [callActive, setCallActive] = useState(null); // { contact, callType, isIncoming, incomingOffer }
  const [incomingCallAlert, setIncomingCallAlert] = useState(null); // { callerInfo, callType, offer }

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

  // Active Contact Object
  const activeContact = contacts.find((c) => c.id === activeContactId) || contacts[0] || null;

  // Contact Selection Handler (Triggers View-Once Burn on unread messages)
  const handleSelectContact = (contact) => {
    setActiveContactId(contact.id);
    setContacts((prev) => prev.map((item) => item.id === contact.id ? { ...item, unreadCount: 0 } : item));

    setMessages((prev) => {
      const thread = prev[contact.id] || [];
      let modified = false;
      const updated = thread.map((m) => {
        if (m.sender !== 'user' && m.burnCountdown === null && m.burnAfterRead) {
          modified = true;
          socketService.emitMessageViewed(m.id, contact.tag, 5);
          return { ...m, burnCountdown: 5 };
        }
        return m;
      });
      return modified ? { ...prev, [contact.id]: updated } : prev;
    });
  };

  // Burn / Shred Message Handler (Completely deletes from state & storage)
  const handleBurnShredMessage = useCallback((messageId, targetContactId = activeContactId) => {
    setMessages((prev) => {
      const thread = prev[targetContactId] || [];
      const updated = thread.filter((m) => m.id !== messageId);
      return { ...prev, [targetContactId]: updated };
    });

    const target = contactsRef.current.find(c => c.id === targetContactId);
    if (target) {
      socketService.emitMessageShredded(messageId, target.tag);
    }
  }, [activeContactId]);

  // Real-time Message Reception Handler
  const handleIncomingSocketMessage = useCallback((payload) => {
    const { message, senderInfo } = payload;
    soundFX.playReceived();

    // Check if sender exists in contacts, otherwise automatically add to contact list!
    let senderContact = contactsRef.current.find((c) => c.tag === senderInfo.tag || c.name === senderInfo.username);
    let targetContactId = senderContact?.id;

    if (!senderContact) {
      targetContactId = `peer_${Date.now()}`;
      senderContact = {
        id: targetContactId,
        name: senderInfo.username,
        tag: senderInfo.tag,
        avatar: senderInfo.avatar,
        status: 'online',
        lastSeen: 'online',
        ip: senderInfo.ip || '192.168.1.x',
        pgp: 'PGP-4096-LIVE-PEER',
        unreadCount: 1,
        pinned: false,
        isSecret: false,
        disappearingTimer: 0,
        customStatus: senderInfo.customStatus || 'Connected Live Peer Node',
        bio: 'Real-time connected client device on mesh relay.',
      };
      setContacts((prev) => [senderContact, ...prev]);
    } else {
      // Increment unread count if not currently looking at this active chat
      if (activeContactRef.current !== senderContact.id) {
        setContacts((prev) =>
          prev.map((c) => (c.id === senderContact.id ? { ...c, unreadCount: (c.unreadCount || 0) + 1, status: 'online' } : c))
        );
      }
    }

    // Push Desktop & HUD Toast Notification
    const payloadSnippet = message.type === 'image' ? '📷 Encrypted Photo'
      : message.type === 'video' ? '🎥 Encrypted Video Stream'
      : message.type === 'audio' ? '🎙️ Voice Intercept'
      : message.type === 'code' ? '💻 Executable Code Payload'
      : message.text || 'Encrypted Payload';

    notificationService.pushToast({
      title: `SIGNAL FROM ${senderInfo.username}`,
      message: payloadSnippet,
      avatar: senderInfo.avatar,
      type: 'info',
      actionLabel: 'OPEN CHAT',
      onAction: () => handleSelectContact(senderContact),
    });

    notificationService.showDesktopNotification(`Chatforge: ${senderInfo.username}`, {
      body: payloadSnippet,
      icon: senderInfo.avatar || '/favicon.svg',
    });

    // Prepare incoming message with Burn-After-Read (View-Once) countdown if active
    const isCurrentlyViewing = activeContactRef.current === targetContactId;
    const incomingMsg = {
      ...message,
      sender: targetContactId,
      status: 'read',
      // If currently viewing, trigger 5s burn countdown immediately
      burnCountdown: isCurrentlyViewing && message.burnAfterRead ? 5 : null,
    };

    setMessages((prev) => ({
      ...prev,
      [targetContactId]: [...(prev[targetContactId] || []), incomingMsg],
    }));

    // If viewing right now, notify sender that message has been viewed
    if (isCurrentlyViewing && message.burnAfterRead) {
      socketService.emitMessageViewed(message.id, senderInfo.tag, 5);
    }
  }, []);

  // Initialize Real-Time Socket Connection when user logs in
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
        setContacts((prev) =>
          prev.map((c) => (c.tag === peer.tag ? { ...c, status: 'online', lastSeen: 'online' } : c))
        );
      },

      // When peer goes offline
      onPeerOffline: (data) => {
        setContacts((prev) =>
          prev.map((c) => (c.tag === data.tag ? { ...c, status: 'offline', lastSeen: data.lastSeen } : c))
        );
      },

      onReceiveMessage: handleIncomingSocketMessage,

      onMessageDelivered: ({ messageId, recipientTag }) => {
        setMessages((prev) => {
          const target = contactsRef.current.find((c) => c.tag === recipientTag);
          if (!target || !prev[target.id]) return prev;
          const updated = prev[target.id].map((m) =>
            m.id === messageId ? { ...m, status: 'delivered', isOutboxPending: false } : m
          );
          return { ...prev, [target.id]: updated };
        });
      },

      // When peer was offline, message saved in sender outbox
      onPeerOfflineAck: ({ messageId, recipientTag }) => {
        setMessages((prev) => {
          const target = contactsRef.current.find((c) => c.tag === recipientTag);
          if (!target || !prev[target.id]) return prev;
          const updated = prev[target.id].map((m) =>
            m.id === messageId ? { ...m, isOutboxPending: true } : m
          );
          return { ...prev, [target.id]: updated };
        });
      },

      // Peer viewed message -> start burn countdown on sender side too!
      onMessageViewedByPeer: ({ messageId, viewerTag, burnDelay }) => {
        setMessages((prev) => {
          const target = contactsRef.current.find((c) => c.tag === viewerTag);
          if (!target || !prev[target.id]) return prev;
          const updated = prev[target.id].map((m) =>
            m.id === messageId ? { ...m, status: 'read', burnCountdown: burnDelay || 5 } : m
          );
          return { ...prev, [target.id]: updated };
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
        const contact = contactsRef.current.find((c) => c.tag === senderTag);
        if (contact) {
          setTypingStatus((prev) => ({ ...prev, [contact.id]: isTyping }));
        }
      },

      onIncomingCall: (callData) => {
        soundFX.playRing();
        setIncomingCallAlert(callData);
        notificationService.showDesktopNotification(`Incoming Call from ${callData.callerInfo.username}`, {
          body: `Encrypted ${callData.callType?.toUpperCase()} Call Intercept Request`,
          icon: callData.callerInfo.avatar || '/favicon.svg',
        });
      },

      onOutboxMessageDispatched: (peerTag, msg) => {
        setMessages((prev) => {
          const target = contactsRef.current.find((c) => c.tag === peerTag);
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
    const existing = contacts.find(c => c.tag === userContact.tag);
    if (existing) {
      handleSelectContact(existing);
      return;
    }

    setContacts((prev) => [userContact, ...prev]);
    setActiveContactId(userContact.id);
  };

  // Send Message Handler
  const handleSendMessage = (messagePayload, targetId = activeContactId) => {
    const targetContact = contacts.find((c) => c.id === targetId);
    if (!targetContact) return;

    const isPeerOnline = targetContact.status === 'online';
    const newMsg = createMessageObject(
      { ...messagePayload, isOutboxPending: !isPeerOnline },
      true,
      gbSettings.hideSecondTick
    );

    // 1. Update Sender's Message Thread State
    setMessages((prev) => ({
      ...prev,
      [targetId]: [...(prev[targetId] || []), newMsg],
    }));

    // 2. Dispatch via Real-time Socket
    if (isPeerOnline) {
      socketService.sendMessage(targetContact.tag, newMsg);
    } else {
      // Peer is offline -> Queue in sender's local storage outbox
      socketService.saveToOutbox(targetContact.tag, newMsg);
      console.log(`[OFFLINE QUEUE] Target ${targetContact.name} is offline. Message saved in your local outbox.`);
    }

    // 3. Reset unread count for target
    setContacts((prev) =>
      prev.map((c) => (c.id === targetId ? { ...c, unreadCount: 0 } : c))
    );
  };

  // Forward Message Handler
  const handleForwardMessage = (origMessage, targetContactIdOrTag) => {
    let targetContact = contacts.find(c => c.id === targetContactIdOrTag || c.tag === targetContactIdOrTag);
    let targetId = targetContact?.id;

    if (!targetContact) {
      targetId = `user_${Date.now()}`;
      const cleanTag = targetContactIdOrTag.startsWith('@') ? targetContactIdOrTag : `@${targetContactIdOrTag}`;
      const newC = {
        id: targetId,
        name: cleanTag.replace(/^@/, ''),
        tag: cleanTag,
        avatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&auto=format&fit=crop&q=80',
        status: 'offline',
        lastSeen: 'offline',
        ip: '192.168.1.x',
        pgp: 'PGP-4096-FORWARD-PEER',
        unreadCount: 0,
        pinned: false,
        isSecret: false,
        disappearingTimer: 0,
        customStatus: 'Forwarded peer node',
        bio: 'Node added from message forward dispatch.',
      };
      setContacts((prev) => [newC, ...prev]);
    }

    const forwardPayload = {
      type: origMessage.type,
      text: origMessage.text,
      mediaUrl: origMessage.mediaUrl,
      code: origMessage.code,
      language: origMessage.language,
      fileName: origMessage.fileName,
      fileSize: origMessage.fileSize,
      checksum: origMessage.checksum,
      audioDuration: origMessage.audioDuration,
      audioWaveform: origMessage.audioWaveform,
    };

    handleSendMessage(forwardPayload, targetId);
  };

  // Logout Handler
  const handleLogout = () => {
    setMyProfile(null);
    localStorage.removeItem('chatforge_my_profile');
    if (socketService.socket) {
      socketService.socket.disconnect();
    }
    setIsRealtimeConnected(false);
  };

  // Reactions Handler
  const handleReactMessage = (messageId, emoji) => {
    if (!activeContact) return;
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

  // Clear All Data
  const handleClearAllData = () => {
    setMessages({});
    setContacts([]);
    setStories([]);
    localStorage.removeItem('chatforge_offline_outbox');
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

  // Accept Incoming Call
  const handleAcceptIncomingCall = (acceptedType) => {
    if (!incomingCallAlert) return;
    const caller = incomingCallAlert.callerInfo;
    const offer = incomingCallAlert.offer;

    setIncomingCallAlert(null);
    setCallActive({
      contact: {
        name: caller.username,
        tag: caller.tag,
        avatar: caller.avatar,
        ip: caller.ip,
        pgp: 'PGP-4096-LIVE-PEER',
      },
      callType: acceptedType || incomingCallAlert.callType,
      isIncoming: true,
      incomingOffer: offer,
    });
  };

  // Reject Incoming Call
  const handleRejectIncomingCall = () => {
    if (incomingCallAlert?.callerInfo?.tag) {
      socketService.emitCallReject(incomingCallAlert.callerInfo.tag, 'CALL_DECLINED_BY_OPERATOR');
    }
    setIncomingCallAlert(null);
  };

  // IF USER IS NOT LOGGED IN -> RENDER TERMINAL LOGIN GATEWAY FIRST!
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

      {/* Background Matrix Effect */}
      <MatrixBackground enabled={gbSettings.matrixRainBg} color={THEMES[theme]?.accent || '#00ff66'} />

      {/* Top Header Bar */}
      <TopBar 
        theme={theme}
        setTheme={setTheme}
        gbSettings={gbSettings}
        setGbSettings={setGbSettings}
        isInspectorOpen={isInspectorOpen}
        setIsInspectorOpen={setIsInspectorOpen}
        onLockApp={() => setIsAppLocked(true)}
        myProfile={myProfile}
        onOpenProfile={() => setShowProfileModal(true)}
        onLogout={handleLogout}
        isRealtimeConnected={isRealtimeConnected}
      />

      {/* Main Split Layout */}
      <div className="chatforge-main-layout">
        
        {/* Left Sidebar */}
        <Sidebar
          contacts={contacts}
          activeContact={activeContact}
          onSelectContact={handleSelectContact}
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
          onStartCall={(contact, type) => setCallActive({ contact, callType: type, isIncoming: false })}
          onUpdateContactDisappearing={handleUpdateContactDisappearing}
          onBurnShredMessage={handleBurnShredMessage}
          onOpenEncryptionModal={(c) => setEncryptionModalContact(c)}
          onOpenMediaVault={(c) => setMediaVaultContact(c)}
          onOpenMediaViewer={(m) => setMediaViewerItem(m)}
          onForwardMessage={(m) => setForwardingMessage(m)}
          isTyping={typingStatus[activeContact?.id]}
          gbSettings={gbSettings}
          onClearThread={handleClearThread}
        />

        {/* Right Hacker Inspector & Console Drawer */}
        <HackerInspector 
          isOpen={isInspectorOpen}
          onClose={() => setIsInspectorOpen(false)}
          gbSettings={gbSettings}
          setGbSettings={setGbSettings}
          autoReplies={autoReplies}
          setAutoReplies={setAutoReplies}
          scheduledMessages={scheduledMessages}
          setScheduledMessages={setScheduledMessages}
          setTheme={setTheme}
          contacts={contacts}
          onBroadcastMessage={handleBroadcastMessage}
          onClearAllData={handleClearAllData}
          onSendMessageToContact={(cId, payload) => handleSendMessage(payload, cId)}
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

      {/* 3. Incoming Call Ringing Alert */}
      {incomingCallAlert && (
        <IncomingCallAlert
          callData={incomingCallAlert}
          onAccept={handleAcceptIncomingCall}
          onReject={handleRejectIncomingCall}
        />
      )}

      {/* 4. Active Encrypted P2P Voice / Video WebRTC Call */}
      {callActive && (
        <CallModal
          contact={callActive.contact}
          callType={callActive.callType}
          isIncoming={callActive.isIncoming}
          incomingOffer={callActive.incomingOffer}
          onClose={() => setCallActive(null)}
        />
      )}

      {/* 5. Full-Screen Photo & Video Media Viewer / Lightbox */}
      {mediaViewerItem && (
        <MediaViewerModal
          media={mediaViewerItem}
          onClose={() => setMediaViewerItem(null)}
          onBurnShred={(msgId) => handleBurnShredMessage(msgId)}
        />
      )}

      {/* 6. Media & Payload Vault Drawer */}
      {mediaVaultContact && (
        <MediaGalleryModal
          contact={mediaVaultContact}
          messages={messages[mediaVaultContact.id] || []}
          onClose={() => setMediaVaultContact(null)}
          onOpenMedia={(item) => setMediaViewerItem(item)}
        />
      )}

      {/* 7. E2EE Security & Safety Number Matrix Inspector */}
      {encryptionModalContact && (
        <EncryptionModal
          myProfile={myProfile}
          contact={encryptionModalContact}
          onClose={() => setEncryptionModalContact(null)}
        />
      )}

      {/* 8. Message Forwarding Modal */}
      {forwardingMessage && (
        <ForwardModal
          message={forwardingMessage}
          contacts={contacts}
          onClose={() => setForwardingMessage(null)}
          onForwardMessage={handleForwardMessage}
        />
      )}

      {/* 9. Status / Story Viewer */}
      {activeStoryId && (
        <StatusViewerModal
          stories={stories}
          initialStoryId={activeStoryId}
          onClose={() => setActiveStoryId(null)}
          onReplyToStatus={(cId, txt) => handleSendMessage({ text: txt }, cId)}
          gbSettings={gbSettings}
        />
      )}

      {/* 10. Direct Message to Unsaved Username/IP */}
      {showDirectChatModal && (
        <DirectChatModal
          onClose={() => setShowDirectChatModal(false)}
          onStartDirectChat={handleStartDirectChat}
        />
      )}

      {/* 11. Mass Message Broadcast Blaster */}
      {showBroadcastModal && (
        <BroadcastModal
          contacts={contacts}
          onClose={() => setShowBroadcastModal(false)}
          onBroadcastMessage={handleBroadcastMessage}
        />
      )}

      {/* 12. Message Scheduler */}
      {showScheduleModal && (
        <ScheduleModal
          contacts={contacts}
          activeContact={activeContact}
          onClose={() => setShowScheduleModal(false)}
          onScheduleMessage={(sched) => setScheduledMessages((prev) => [...prev, sched])}
        />
      )}

      {/* 13. Operator Profile & Multi-Device Pairing */}
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

      {/* 14. Global Username Search Modal */}
      {showSearchUserModal && (
        <SearchUserModal
          currentProfile={myProfile}
          existingContacts={contacts}
          onSelectAndAddContact={handleSelectAndAddContact}
          onClose={() => setShowSearchUserModal(false)}
        />
      )}

    </div>
  );
}

export default App;
