import React, { useRef, useEffect, useState } from 'react';
import { 
  ArrowLeft, 
  ShieldCheck, 
  Trash2, 
  Radio, 
  Check, 
  CheckCheck, 
  MoreVertical,
  Download,
  FileText,
  Lock,
  Archive,
  CornerUpRight,
  Copy,
  Flame,
  Clock,
  Play,
  Pause,
  Code as CodeIcon,
  Maximize2
} from 'lucide-react';
import { useChat } from '../../context/useChat';
import { MessageInput } from './MessageInput';
import { EmptyState } from './EmptyState';
import { soundFX } from '../../services/audioService';

const REACTION_EMOJIS = ['🔥', '❤️', '⚡', '💀', '👍'];

function AudioPlayerMessage({ audioUrl, duration }) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  const audioRef = useRef(null);

  const togglePlay = () => {
    soundFX.playKeypress();
    if (audioRef.current) {
      if (isPlaying) {
        audioRef.current.pause();
        setIsPlaying(false);
      } else {
        audioRef.current.playbackRate = speed;
        audioRef.current.play()
          .then(() => setIsPlaying(true))
          .catch(() => {
            setIsPlaying(true);
            setTimeout(() => setIsPlaying(false), 3000 / speed);
          });
      }
    }
  };

  const cycleSpeed = () => {
    soundFX.playKeypress();
    const speeds = [1, 1.5, 2];
    const nextSpeed = speeds[(speeds.indexOf(speed) + 1) % speeds.length];
    setSpeed(nextSpeed);
    if (audioRef.current) {
      audioRef.current.playbackRate = nextSpeed;
    }
  };

  return (
    <div className="audio-voice-player flex items-center gap-3 p-2 bg-black/30 rounded border border-border/50 max-w-xs mb-2">
      {audioUrl && (
        <audio 
          ref={audioRef} 
          src={audioUrl} 
          onEnded={() => setIsPlaying(false)} 
          onError={() => setIsPlaying(false)} 
        />
      )}
      <button 
        type="button" 
        className="cyber-btn btn-icon bg-accent/20 text-accent hover:bg-accent hover:text-black transition-colors"
        onClick={togglePlay}
      >
        {isPlaying ? <Pause size={14} /> : <Play size={14} className="ml-0.5" />}
      </button>

      <div className="flex-1 flex items-center gap-1">
        <div className="flex items-center gap-0.5 h-4 flex-1">
          {[40, 75, 50, 90, 60, 100, 30, 70, 85, 45, 95, 60, 80, 50].map((h, i) => (
            <span 
              key={i} 
              className={`w-1 rounded-full transition-all ${isPlaying ? 'bg-accent animate-pulse' : 'bg-muted/40'}`}
              style={{ height: `${h}%` }}
            />
          ))}
        </div>
        <span className="text-[10px] text-muted font-mono ml-1">{duration || '0:12'}</span>
      </div>

      <button 
        type="button" 
        className="text-[10px] text-muted hover:text-accent font-mono px-1 border border-border rounded"
        onClick={cycleSpeed}
      >
        {speed}x
      </button>
    </div>
  );
}

export const ChatArea = () => {
  const {
    activeContact,
    selectContact,
    messages,
    clearChat,
    typingStatus,
    reactMessage,
    deleteMessage,
    openModal,
  } = useChat();

  const [showMenu, setShowMenu] = useState(false);
  const [copiedId, setCopiedId] = useState(null);
  const messagesEndRef = useRef(null);

  // Auto-scroll to bottom
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages.length, typingStatus]);

  const handleCopyText = (id, text) => {
    soundFX.playKeypress();
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 1500);
  };

  if (!activeContact) {
    return <EmptyState onStartChat={() => {}} />;
  }

  return (
    <main className="chatarea">
      {/* Active Conversation Top Bar */}
      <div className="chatarea-header">
        <div className="flex items-center gap-3">
          {/* Mobile Back Button */}
          <button
            type="button"
            className="cyber-btn btn-icon mobile-back-btn md:hidden"
            onClick={() => selectContact(null)}
            title="Back to Nodes"
          >
            <ArrowLeft size={16} />
          </button>

          {/* Peer Avatar & Details */}
          <div className="relative flex-shrink-0">
            <img
              src={activeContact.avatar || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&auto=format&fit=crop&q=80'}
              alt={activeContact.name}
              className="chat-avatar"
            />
            <span
              className={`status-dot ${
                activeContact.status === 'online' ? 'online' : 'offline'
              }`}
            />
          </div>

          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-sm text-text-main">{activeContact.name || activeContact.tag}</span>
              <span className="text-[11px] text-accent font-mono">{activeContact.tag}</span>
            </div>
            <div className="text-[11px] text-muted flex items-center gap-1.5">
              {typingStatus ? (
                <span className="text-accent flex items-center gap-1">
                  <Radio size={11} className="animate-pulse" /> transmitting packets...
                </span>
              ) : activeContact.status === 'online' ? (
                <span className="text-accent font-semibold">Active Node</span>
              ) : (
                <span>Last seen: {activeContact.lastSeen || 'offline'}</span>
              )}
            </div>
          </div>
        </div>

        {/* Right Header Actions */}
        <div className="flex items-center gap-2">
          {/* E2EE Safety Number Cipher Inspector */}
          <button
            type="button"
            className="cyber-btn text-[11px] flex items-center gap-1 px-2.5 py-1"
            onClick={() => openModal('encryption', activeContact)}
            title="Inspect E2EE Zero-Knowledge Cipher & Safety Numbers"
          >
            <Lock size={12} className="text-accent" />
            <span className="hidden sm:inline">CIPHER MATRIX</span>
          </button>

          {/* Session Media Vault */}
          <button
            type="button"
            className="cyber-btn btn-icon"
            onClick={() => openModal('gallery', activeContact)}
            title="Session Media Vault / Payloads"
          >
            <Archive size={15} />
          </button>

          {/* Dropdown Menu */}
          <div className="relative">
            <button
              type="button"
              className="cyber-btn btn-icon"
              onClick={() => setShowMenu(!showMenu)}
            >
              <MoreVertical size={15} />
            </button>

            {showMenu && (
              <div className="absolute right-0 mt-1 w-48 bg-bg-card border border-border rounded shadow-lg z-20 py-1 text-xs">
                <button
                  type="button"
                  className="w-full px-3 py-2 text-left hover:bg-bg-card-hover flex items-center gap-2 text-text-main"
                  onClick={() => {
                    openModal('schedule');
                    setShowMenu(false);
                  }}
                >
                  <Clock size={13} className="text-accent" /> Schedule Transmission
                </button>
                <button
                  type="button"
                  className="w-full px-3 py-2 text-left hover:bg-bg-card-hover flex items-center gap-2 text-text-main"
                  onClick={() => {
                    openModal('encryption', activeContact);
                    setShowMenu(false);
                  }}
                >
                  <Lock size={13} className="text-accent" /> Verify Safety Numbers
                </button>
                <button
                  type="button"
                  className="w-full px-3 py-2 text-left hover:bg-bg-card-hover flex items-center gap-2 text-text-main"
                  onClick={() => {
                    openModal('gallery', activeContact);
                    setShowMenu(false);
                  }}
                >
                  <Archive size={13} className="text-accent" /> Media Vault
                </button>
                <div className="border-t border-border my-1" />
                <button
                  type="button"
                  className="w-full px-3 py-2 text-left hover:bg-bg-card-hover flex items-center gap-2 text-danger"
                  onClick={() => {
                    clearChat();
                    setShowMenu(false);
                  }}
                >
                  <Trash2 size={13} /> Clear Chat Thread
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Messages Thread Feed */}
      <div className="messages-feed">
        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-muted text-xs">
            <ShieldCheck size={36} className="text-accent opacity-40 mb-2" />
            <p className="font-bold text-text-main">SECURE CHANNEL ESTABLISHED</p>
            <p className="text-[11px] text-muted mt-1">Direct end-to-end encrypted link with {activeContact.name || activeContact.tag}.</p>
          </div>
        ) : (
          messages.map((msg) => {
            const isUser = msg.sender === 'user';
            const mediaSrc = msg.mediaUrl || msg.file?.data || msg.file?.url || msg.audioUrl;
            const isImage = (msg.file && msg.file.type?.startsWith('image/')) || msg.type === 'image';
            const isAudio = msg.type === 'audio' || !!msg.audioUrl;
            const isCode = msg.type === 'code' || !!msg.code;

            return (
              <div
                key={msg.id}
                className={`message-row ${isUser ? 'sent' : 'received'}`}
              >
                <div className={`message-bubble ${isUser ? 'user-bubble' : 'contact-bubble'}`}>
                  {/* Deleted message indicator */}
                  {msg.deleted ? (
                    <span className="italic text-muted text-xs">🚫 This message was deleted</span>
                  ) : (
                    <>
                      {/* Burn-After-Read Warning Header */}
                      {msg.burnAfterRead && (
                        <div className="flex items-center gap-1.5 text-[10px] text-danger mb-1 font-mono">
                          <Flame size={12} className="animate-pulse" />
                          <span>DISAPPEARING PAYLOAD</span>
                        </div>
                      )}

                      {/* Image Attachment */}
                      {isImage && mediaSrc && (
                        <div 
                          className="mb-2 rounded overflow-hidden max-w-sm cursor-pointer group relative border border-border/40"
                          onClick={() => openModal('mediaViewer', msg)}
                        >
                          <img
                            src={mediaSrc}
                            alt={msg.fileName || 'attachment'}
                            className="max-h-60 rounded object-cover w-full group-hover:scale-[1.02] transition-transform duration-200"
                          />
                          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity text-accent">
                            <Maximize2 size={20} />
                          </div>
                        </div>
                      )}

                      {/* Voice Note Audio Player */}
                      {isAudio && (
                        <AudioPlayerMessage 
                          audioUrl={mediaSrc} 
                          duration={msg.audioDuration} 
                        />
                      )}

                      {/* Code Snippet */}
                      {isCode && (
                        <div className="mb-2 rounded bg-black/60 border border-border p-2 font-mono text-xs max-w-md">
                          <div className="flex items-center justify-between border-b border-border/40 pb-1 mb-1.5 text-[10px] text-accent">
                            <span className="flex items-center gap-1">
                              <CodeIcon size={12} /> {msg.language || 'SNIPPET'}
                            </span>
                            <button
                              type="button"
                              className="hover:text-text-main flex items-center gap-1"
                              onClick={() => handleCopyText(msg.id, msg.code || msg.text)}
                            >
                              {copiedId === msg.id ? <Check size={11} /> : <Copy size={11} />}
                              <span>{copiedId === msg.id ? 'COPIED' : 'COPY'}</span>
                            </button>
                          </div>
                          <pre className="overflow-x-auto text-[11px] text-text-main whitespace-pre-wrap">
                            {msg.code || msg.text}
                          </pre>
                        </div>
                      )}

                      {/* Generic File Attachment */}
                      {msg.file && !isImage && !isAudio && (
                        <div className="flex items-center gap-2 p-2 mb-2 bg-black/20 rounded border border-border text-xs">
                          <FileText size={16} className="text-accent flex-shrink-0" />
                          <div className="truncate flex-1">
                            <div className="font-semibold truncate">{msg.file.name || msg.fileName}</div>
                            {msg.file.size && <div className="text-[10px] text-muted">{msg.file.size}</div>}
                          </div>
                          <a
                            href={mediaSrc}
                            download={msg.file.name || msg.fileName || 'file'}
                            className="text-accent hover:underline flex items-center gap-1 p-1 bg-black/40 rounded border border-border/50"
                          >
                            <Download size={13} />
                          </a>
                        </div>
                      )}

                      {/* Text Content */}
                      {msg.text && !isCode && (
                        <p className="message-text whitespace-pre-wrap break-words">{msg.text}</p>
                      )}
                    </>
                  )}

                  {/* Reactions Display */}
                  {msg.reactions && Object.keys(msg.reactions).length > 0 && (
                    <div className="flex gap-1 mt-1.5 flex-wrap">
                      {Object.entries(msg.reactions).map(([emoji, count]) => (
                        <span key={emoji} className="bg-black/40 px-1.5 py-0.5 rounded text-[10px] border border-border flex items-center gap-1">
                          <span>{emoji}</span>
                          <span className="text-muted font-mono">{count}</span>
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Message Meta Info: Reactions Picker, Forward, Delete & Timestamp */}
                  <div className="message-meta flex items-center justify-between mt-1 pt-1 border-t border-white/5 gap-2">
                    <div className="flex items-center gap-1.5">
                      {/* Reaction quick emojis */}
                      {REACTION_EMOJIS.slice(0, 3).map((emoji) => (
                        <button
                          key={emoji}
                          type="button"
                          className="text-[10px] opacity-60 hover:opacity-100 hover:scale-125 transition-transform"
                          title={`React with ${emoji}`}
                          onClick={() => reactMessage(msg.id, emoji)}
                        >
                          {emoji}
                        </button>
                      ))}

                      {/* Forward action */}
                      {!msg.deleted && (
                        <button
                          type="button"
                          className="text-[10px] text-muted hover:text-accent ml-1 transition-colors"
                          title="Forward payload"
                          onClick={() => openModal('forward', msg)}
                        >
                          <CornerUpRight size={12} />
                        </button>
                      )}

                      {/* Copy text action */}
                      {msg.text && !msg.deleted && (
                        <button
                          type="button"
                          className="text-[10px] text-muted hover:text-accent transition-colors"
                          title="Copy payload text"
                          onClick={() => handleCopyText(msg.id, msg.text)}
                        >
                          {copiedId === msg.id ? <Check size={11} className="text-accent" /> : <Copy size={11} />}
                        </button>
                      )}

                      {/* Delete action */}
                      {isUser && !msg.deleted && (
                        <button
                          type="button"
                          className="text-[10px] text-muted hover:text-danger ml-0.5 transition-colors"
                          title="Delete transmission for everyone"
                          onClick={() => deleteMessage(msg.id, true)}
                        >
                          <Trash2 size={11} />
                        </button>
                      )}
                    </div>

                    <div className="flex items-center gap-1 text-[10px]">
                      <span className="message-time font-mono">{msg.timestamp}</span>
                      {isUser && (
                        <span className="message-status">
                          {msg.status === 'delivered' ? (
                            <CheckCheck size={13} className="text-muted" />
                          ) : msg.status === 'read' ? (
                            <CheckCheck size={13} className="text-accent" />
                          ) : (
                            <Check size={13} className="text-muted" />
                          )}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Message Input Component */}
      <MessageInput />
    </main>
  );
};
