import React, { useState, useEffect } from 'react';
import { 
  Check, 
  CheckCheck, 
  ShieldAlert, 
  Play, 
  Pause, 
  FileCode, 
  FileText, 
  Download, 
  Copy, 
  CornerUpLeft, 
  MoreVertical, 
  Trash2, 
  Smile,
  Flame,
  Clock,
  Radio
} from 'lucide-react';
import { soundFX } from '../services/audioService';

const REACTION_EMOJIS = ['⚡', '🔥', '💀', '👾', '🛡️', '👁️', '💻'];

const MessageItem = ({ 
  message, 
  isUser, 
  onReact, 
  onDeleteForEveryone, 
  onDeleteForMe, 
  onReply,
  onBurnShredMessage,
  gbSettings 
}) => {
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  const [audioSpeed, setAudioSpeed] = useState(1);
  const [showMenu, setShowMenu] = useState(false);
  const [showReactPicker, setShowReactPicker] = useState(false);
  const [copied, setCopied] = useState(false);
  
  // Burn countdown state
  const [burnSecondsRemaining, setBurnSecondsRemaining] = useState(
    message.burnCountdown !== undefined ? message.burnCountdown : null
  );

  // Active burn-after-read countdown timer
  useEffect(() => {
    if (burnSecondsRemaining !== null && burnSecondsRemaining > 0) {
      const timer = setTimeout(() => {
        setBurnSecondsRemaining(prev => prev - 1);
      }, 1000);
      return () => clearTimeout(timer);
    } else if (burnSecondsRemaining === 0) {
      soundFX.playGlitchAlarm();
      if (onBurnShredMessage) {
        onBurnShredMessage(message.id);
      }
    }
  }, [burnSecondsRemaining, message.id, onBurnShredMessage]);

  const handleCopy = (text) => {
    soundFX.playKeypress();
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const toggleAudioPlay = () => {
    soundFX.playKeypress();
    setIsPlayingAudio(!isPlayingAudio);
    if (!isPlayingAudio) {
      soundFX.playBeep(440, 'triangle', 0.1);
      setTimeout(() => {
        setIsPlayingAudio(false);
      }, 5000 / audioSpeed);
    }
  };

  const cycleSpeed = (e) => {
    e.stopPropagation();
    soundFX.playKeypress();
    const speeds = [1, 1.5, 2];
    const next = speeds[(speeds.indexOf(audioSpeed) + 1) % speeds.length];
    setAudioSpeed(next);
  };

  const getStatusIcon = () => {
    if (!isUser) return null;
    if (message.isOutboxPending) {
      return (
        <span className="outbox-pending-tag" title="Peer is currently offline. Stored in sender local outbox. Will auto-send when peer comes online.">
          <Clock size={12} className="text-warning" />
        </span>
      );
    }
    if (message.status === 'read' && !gbSettings.hideBlueTicks) {
      return <CheckCheck size={14} className="tick-read" />;
    }
    if (message.status === 'delivered' || message.status === 'read') {
      return <CheckCheck size={14} className="tick-delivered" />;
    }
    return <Check size={14} className="tick-sent" />;
  };

  return (
    <div className={`message-row ${isUser ? 'user-row' : 'contact-row'}`}>
      <div className={`message-bubble ${isUser ? 'user-bubble' : 'contact-bubble'} ${message.isDeletedBySender ? 'is-revoked' : ''} ${burnSecondsRemaining !== null ? 'is-burning' : ''}`}>
        
        {/* Offline Outbox Banner */}
        {message.isOutboxPending && isUser && (
          <div className="outbox-queue-banner">
            <Radio size={12} className="pulse-icon text-warning" />
            <span>QUEUED IN LOCAL OUTBOX (PEER OFFLINE)</span>
          </div>
        )}

        {/* Burn-After-Read (View-Once) Shredder Header */}
        {burnSecondsRemaining !== null && (
          <div className="burn-shredder-header">
            <Flame size={14} className="flame-icon animate-pulse text-danger" />
            <span className="burn-text">
              VIEW-ONCE PROTOCOL: AUTO-SHREDDING IN {burnSecondsRemaining}s
            </span>
          </div>
        )}

        {/* Anti-Delete Revoked Badge */}
        {message.isDeletedBySender && gbSettings.antiDeleteMessages && (
          <div className="revoked-header">
            <ShieldAlert size={14} className="revoked-icon" />
            <span className="revoked-text">ANTI-DELETE ENGINE: SENDER REVOKED THIS MESSAGE AT {message.deletedAt || 'REC'}</span>
          </div>
        )}

        {/* Quoted Message / Reply Preview */}
        {message.replyTo && (
          <div className="reply-preview-box">
            <span className="reply-sender">{message.replyTo.sender}</span>
            <span className="reply-snippet">{message.replyTo.text}</span>
          </div>
        )}

        {/* Message Content according to type */}
        {message.type === 'code' ? (
          <div className="code-block-wrapper">
            <div className="code-header">
              <span className="code-lang"><FileCode size={12} /> {message.language || 'PYTHON'}</span>
              <button className="code-copy-btn" onClick={() => handleCopy(message.code)}>
                <Copy size={12} />
                <span>{copied ? 'COPIED!' : 'EXTRACT'}</span>
              </button>
            </div>
            <pre className="code-content">
              <code>{message.code}</code>
            </pre>
            {message.text && <p className="bubble-text code-caption">{message.text}</p>}
          </div>
        ) : message.type === 'audio' ? (
          <div className="audio-voice-player">
            <button className="audio-play-btn" onClick={toggleAudioPlay}>
              {isPlayingAudio ? <Pause size={16} /> : <Play size={16} />}
            </button>

            <div className="waveform-container">
              {(message.audioWaveform || [30, 60, 90, 40, 80, 100, 70, 50, 85, 60, 40, 95, 55]).map((height, i) => (
                <div 
                  key={i} 
                  className={`wave-bar ${isPlayingAudio ? 'animating' : ''}`}
                  style={{ 
                    height: `${height}%`,
                    animationDelay: `${i * 0.08}s`
                  }}
                />
              ))}
            </div>

            <div className="audio-meta">
              <span className="audio-duration">{message.audioDuration || '0:12'}</span>
              <button className="audio-speed-tag" onClick={cycleSpeed}>
                {audioSpeed}x
              </button>
            </div>
          </div>
        ) : message.type === 'file' ? (
          <div className="file-payload-box">
            <div className="file-icon-box">
              <FileText size={22} />
            </div>
            <div className="file-info">
              <span className="file-name">{message.fileName}</span>
              <span className="file-meta">{message.fileSize} • SHA-256</span>
              <span className="file-hash">{message.checksum?.substring(0, 16)}...</span>
            </div>
            <button className="file-download-btn" onClick={() => handleCopy(message.checksum)}>
              <Download size={15} />
            </button>
          </div>
        ) : (
          <p className="bubble-text">{message.text}</p>
        )}

        {/* Bubble Meta (Time, Ticks, Actions) */}
        <div className="bubble-footer">
          <div className="bubble-actions-trigger">
            <button 
              className="quick-react-trigger" 
              onClick={() => setShowReactPicker(!showReactPicker)}
              title="Add Reaction"
            >
              <Smile size={12} />
            </button>

            <button 
              className="quick-menu-trigger" 
              onClick={() => setShowMenu(!showMenu)}
              title="Message Options"
            >
              <MoreVertical size={12} />
            </button>
          </div>

          <span className="bubble-timestamp">{message.timestamp}</span>
          {getStatusIcon()}
        </div>

        {/* Reactions Display */}
        {message.reactions && message.reactions.length > 0 && (
          <div className="reactions-container">
            {message.reactions.map((r, i) => (
              <span key={i} className="reaction-badge">{r}</span>
            ))}
          </div>
        )}

        {/* Emoji Reaction Popover */}
        {showReactPicker && (
          <div className="reaction-picker-popover">
            {REACTION_EMOJIS.map((emoji) => (
              <button 
                key={emoji} 
                className="reaction-opt-btn"
                onClick={() => {
                  soundFX.playKeypress();
                  onReact(message.id, emoji);
                  setShowReactPicker(false);
                }}
              >
                {emoji}
              </button>
            ))}
          </div>
        )}

        {/* Message Options Dropdown */}
        {showMenu && (
          <div className="message-context-menu">
            <button onClick={() => { soundFX.playKeypress(); onReply(message); setShowMenu(false); }}>
              <CornerUpLeft size={12} /> Reply
            </button>
            <button onClick={() => { handleCopy(message.text || message.code); setShowMenu(false); }}>
              <Copy size={12} /> Copy Payload
            </button>
            {isUser && (
              <button className="danger-action" onClick={() => { soundFX.playGlitchAlarm(); onDeleteForEveryone(message.id); setShowMenu(false); }}>
                <Trash2 size={12} /> Delete for Everyone (Revoke)
              </button>
            )}
            <button className="danger-action" onClick={() => { soundFX.playKeypress(); onDeleteForMe(message.id); setShowMenu(false); }}>
              <Trash2 size={12} /> Delete for Me
            </button>
          </div>
        )}

      </div>
    </div>
  );
};

export default MessageItem;
