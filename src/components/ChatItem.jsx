import React from 'react';
import { Pin, Lock, ShieldAlert, Check, CheckCheck, Clock } from 'lucide-react';
import { soundFX } from '../services/audioService';

const ChatItem = ({ 
  contact, 
  isActive, 
  onSelect, 
  lastMessage, 
  isTyping,
  gbSettings
}) => {
  const handleClick = () => {
    soundFX.playKeypress();
    onSelect(contact);
  };

  const getStatusIcon = () => {
    if (!lastMessage || lastMessage.sender !== 'user') return null;
    
    if (lastMessage.status === 'read' && !gbSettings.hideBlueTicks) {
      return <CheckCheck size={14} className="text-accent" />;
    } else if (lastMessage.status === 'delivered' || lastMessage.status === 'read') {
      return <CheckCheck size={14} className="text-muted" />;
    }
    return <Check size={14} className="text-muted" />;
  };

  return (
    <div 
      className={`chat-item ${isActive ? 'active' : ''} ${contact.pinned ? 'is-pinned' : ''}`}
      onClick={handleClick}
    >
      <div className="avatar-wrapper">
        <img src={contact.avatar} alt={contact.name} className="chat-avatar" />
        <div className={`status-dot ${contact.status}`}></div>
      </div>

      <div className="chat-item-content">
        <div className="chat-item-header">
          <div className="name-container">
            {contact.pinned && <Pin size={12} className="pin-icon" />}
            {contact.isSecret && <Lock size={12} className="secret-icon" />}
            <span className="contact-name">{contact.name}</span>
            <span className="contact-tag">{contact.tag}</span>
          </div>

          <span className="message-time">
            {lastMessage ? lastMessage.timestamp : contact.lastSeen}
          </span>
        </div>

        <div className="chat-item-footer">
          <div className="message-preview">
            {getStatusIcon()}
            {isTyping ? (
              <span className="typing-indicator-text">
                <span className="typing-dots">⚡ decrypting stream...</span>
              </span>
            ) : lastMessage?.isDeletedBySender ? (
              <span className="revoked-preview">
                <ShieldAlert size={12} className="inline-shield" />
                [REVOKED]: {lastMessage.text.replace('[REVOKED MESSAGE]: ', '')}
              </span>
            ) : (
              <span className="preview-text">
                {lastMessage 
                  ? (lastMessage.type === 'code' ? '💻 [Code Snippet]' : 
                     lastMessage.type === 'audio' ? '🎙️ [Voice Intercept]' : 
                     lastMessage.type === 'file' ? `📁 ${lastMessage.fileName}` : 
                     lastMessage.text)
                  : contact.customStatus}
              </span>
            )}
          </div>

          <div className="badges-wrapper">
            {contact.disappearingTimer > 0 && (
              <span className="disappearing-badge" title={`Disappearing messages: ${contact.disappearingTimer}s`}>
                <Clock size={10} />
                {contact.disappearingTimer}s
              </span>
            )}
            {contact.unreadCount > 0 && (
              <span className="unread-badge">{contact.unreadCount}</span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ChatItem;