import React, { useState, useEffect, useRef } from 'react';
import { 
  Phone, 
  Video, 
  Shield, 
  Lock, 
  Search, 
  MoreVertical, 
  Clock, 
  Trash2, 
  Download, 
  Terminal, 
  Zap, 
  Radio, 
  X
} from 'lucide-react';
import MessageItem from './MessageItem';
import MessageInput from './MessageInput';
import { soundFX } from '../services/audioService';

const ChatArea = ({
  activeContact,
  messages,
  onSendMessage,
  onReactMessage,
  onDeleteForEveryone,
  onDeleteForMe,
  onStartCall,
  onUpdateContactDisappearing,
  onBurnShredMessage,
  isTyping,
  gbSettings,
  onClearThread
}) => {
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [replyingTo, setReplyingTo] = useState(null);
  const [showOptionsDropdown, setShowOptionsDropdown] = useState(false);
  const [showDisappearingMenu, setShowDisappearingMenu] = useState(false);

  const messagesEndRef = useRef(null);

  const currentMessages = activeContact ? (messages[activeContact.id] || []) : [];

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [currentMessages.length, isTyping]);

  if (!activeContact) {
    return (
      <div className="chatarea empty-state">
        <div className="empty-content">
          <div className="radar-glow">
            <Terminal size={48} className="text-accent" />
          </div>
          <h2>CHATFORGE PROTOCOL // STANDBY</h2>
          <p className="desc">
            Select a target node from the left frequency matrix to initiate an encrypted end-to-end P2P session.
          </p>
          <div className="quick-intel-cards">
            <div className="intel-card">
              <Shield size={16} className="text-accent" />
              <span>Quantum-Resistant AES-256 GCM</span>
            </div>
            <div className="intel-card">
              <Radio size={16} className="text-accent" />
              <span>GB Anti-Delete Interceptor Active</span>
            </div>
            <div className="intel-card">
              <Zap size={16} className="text-accent" />
              <span>Multi-Hop Relay Anonymization</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Filter messages by in-chat search if active
  const displayedMessages = searchTerm.trim()
    ? currentMessages.filter(m => (m.text || '').toLowerCase().includes(searchTerm.toLowerCase()) || (m.code || '').toLowerCase().includes(searchTerm.toLowerCase()))
    : currentMessages;

  const setTimer = (seconds) => {
    soundFX.playKeypress();
    onUpdateContactDisappearing(activeContact.id, seconds);
    setShowDisappearingMenu(false);
  };

  const handleExportChat = () => {
    soundFX.playKeypress();
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(currentMessages, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", `chatforge_${activeContact.tag}_transcript.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
    setShowOptionsDropdown(false);
  };

  return (
    <main className="chatarea">
      {/* Active Contact Header */}
      <div className="chatarea-header">
        <div className="contact-intel-box">
          <div className="avatar-box">
            <img src={activeContact.avatar} alt={activeContact.name} className="chat-avatar" />
            <span className={`status-dot ${activeContact.status}`}></span>
          </div>

          <div className="intel-details">
            <div className="intel-name-row">
              <span className="intel-name">{activeContact.name}</span>
              <span className="intel-tag">{activeContact.tag}</span>
              {activeContact.isSecret && (
                <span className="secret-indicator-tag" title="Classified Secret Session">
                  <Lock size={11} /> SECRET
                </span>
              )}
            </div>

            <div className="intel-meta-row">
              <span className="meta-ip">IP: {activeContact.ip}</span>
              <span className="meta-pgp">KEY: {activeContact.pgp}</span>
              <span className="meta-seen">{activeContact.status === 'online' ? '● ONLINE' : `LAST SEEN: ${activeContact.lastSeen}`}</span>
            </div>
          </div>
        </div>

        {/* Header Action Tools */}
        <div className="chatarea-actions">
          {/* Voice Call */}
          <button 
            className="action-icon-btn" 
            onClick={() => onStartCall(activeContact, 'audio')}
            title="Start Encrypted P2P Voice Call"
          >
            <Phone size={17} />
          </button>

          {/* Video Call */}
          <button 
            className="action-icon-btn" 
            onClick={() => onStartCall(activeContact, 'video')}
            title="Start Encrypted Video HUD Call"
          >
            <Video size={17} />
          </button>

          {/* In-Chat Search */}
          <button 
            className={`action-icon-btn ${searchOpen ? 'active' : ''}`} 
            onClick={() => {
              setSearchOpen(!searchOpen);
              if (searchOpen) setSearchTerm('');
            }}
            title="Search In Conversation"
          >
            <Search size={17} />
          </button>

          {/* Disappearing Timer Button */}
          <div className="disappearing-menu-wrapper">
            <button 
              className={`action-icon-btn ${activeContact.disappearingTimer > 0 ? 'active' : ''}`}
              onClick={() => setShowDisappearingMenu(!showDisappearingMenu)}
              title="Disappearing Messages Timer"
            >
              <Clock size={17} />
            </button>

            {showDisappearingMenu && (
              <div className="disappearing-dropdown">
                <div className="dropdown-title">EPHEMERAL SHREDDER</div>
                <button className={activeContact.disappearingTimer === 0 ? 'selected' : ''} onClick={() => setTimer(0)}>Off</button>
                <button className={activeContact.disappearingTimer === 5 ? 'selected' : ''} onClick={() => setTimer(5)}>5 Seconds</button>
                <button className={activeContact.disappearingTimer === 30 ? 'selected' : ''} onClick={() => setTimer(30)}>30 Seconds</button>
                <button className={activeContact.disappearingTimer === 3600 ? 'selected' : ''} onClick={() => setTimer(3600)}>1 Hour</button>
                <button className={activeContact.disappearingTimer === 86400 ? 'selected' : ''} onClick={() => setTimer(86400)}>24 Hours</button>
              </div>
            )}
          </div>

          {/* More Options Dropdown */}
          <div className="more-options-wrapper">
            <button 
              className="action-icon-btn"
              onClick={() => setShowOptionsDropdown(!showOptionsDropdown)}
              title="Session Options"
            >
              <MoreVertical size={17} />
            </button>

            {showOptionsDropdown && (
              <div className="options-dropdown">
                <button onClick={handleExportChat}>
                  <Download size={14} /> Export Transcript (.JSON)
                </button>
                <button onClick={() => { soundFX.playGlitchAlarm(); onClearThread(activeContact.id); setShowOptionsDropdown(false); }}>
                  <Trash2 size={14} className="text-danger" /> Clear Buffer Logs
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* In-Chat Search Bar */}
      {searchOpen && (
        <div className="chat-search-bar">
          <Search size={14} className="text-accent" />
          <input 
            type="text" 
            placeholder="Search within this encrypted frequency..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            autoFocus
          />
          <button className="btn-close-search" onClick={() => { setSearchOpen(false); setSearchTerm(''); }}>
            <X size={14} />
          </button>
        </div>
      )}

      {/* Ephemeral / Disappearing Banner */}
      {activeContact.disappearingTimer > 0 && (
        <div className="ephemeral-banner">
          <Clock size={13} />
          <span>EPHEMERAL SHREDDER ACTIVE: Packets in this channel self-destruct after {activeContact.disappearingTimer}s</span>
        </div>
      )}

      {/* Messages Scroll Feed */}
      <div className="messages-feed">
        <div className="encryption-notice-bubble">
          <Shield size={14} />
          <span>Messages and calls are end-to-end encrypted with RSA-4096 and P2P Quantum Lattice. No third party or relay node can intercept.</span>
        </div>

        {displayedMessages.map((msg) => (
          <MessageItem
            key={msg.id}
            message={msg}
            isUser={msg.sender === 'user'}
            onReact={onReactMessage}
            onDeleteForEveryone={onDeleteForEveryone}
            onDeleteForMe={onDeleteForMe}
            onReply={(m) => setReplyingTo(m)}
            onBurnShredMessage={onBurnShredMessage}
            gbSettings={gbSettings}
          />
        ))}

        {/* Real-time Typing Indicator */}
        {isTyping && (
          <div className="typing-bubble-row">
            <div className="typing-bubble">
              <span className="dot"></span>
              <span className="dot"></span>
              <span className="dot"></span>
              <span className="typing-label">{activeContact.name} is encoding payload...</span>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Composer Input Area */}
      <MessageInput 
        onSendMessage={onSendMessage}
        replyingTo={replyingTo}
        onCancelReply={() => setReplyingTo(null)}
        activeContact={activeContact}
      />
    </main>
  );
};

export default ChatArea;