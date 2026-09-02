import React, { useRef, useEffect, useState, useMemo } from 'react';
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
  Maximize2,
  Pin,
  Search,
  ChevronUp,
  ChevronDown,
  X
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
    pinnedMessageIds,
    togglePinMessage,
    isChatSearchOpen,
    setIsChatSearchOpen,
    chatSearchQuery,
    setChatSearchQuery,
  } = useChat();

  const [showMenu, setShowMenu] = useState(false);
  const [copiedId, setCopiedId] = useState(null);
  const [currentMatchIndex, setCurrentMatchIndex] = useState(0);
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

  // Search matches within active thread
  const searchMatches = useMemo(() => {
    if (!chatSearchQuery.trim()) return [];
    const q = chatSearchQuery.toLowerCase();
    return messages.filter(
      (m) =>
        (m.text && m.text.toLowerCase().includes(q)) ||
        (m.fileName && m.fileName.toLowerCase().includes(q)) ||
        (m.code && m.code.toLowerCase().includes(q))
    );
  }, [messages, chatSearchQuery]);

  // Jump to matched message in chat
  const jumpToMatch = (index) => {
    if (searchMatches.length === 0) return;
    const targetIdx = (index + searchMatches.length) % searchMatches.length;
    setCurrentMatchIndex(targetIdx);
    const targetMsg = searchMatches[targetIdx];
    if (targetMsg) {
      const el = document.getElementById(`msg-${targetMsg.id}`);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        el.classList.add('pulse-match');
        setTimeout(() => el.classList.remove('pulse-match'), 1600);
      }
    }
  };

  // Jump to specific message by ID
  const jumpToMessage = (msgId) => {
    const el = document.getElementById(`msg-${msgId}`);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      el.classList.add('pulse-match');
      setTimeout(() => el.classList.remove('pulse-match'), 1600);
    }
  };

  // Helper to highlight matching text
  const renderHighlightedText = (text, query) => {
    if (!query || !query.trim() || !text) return text;
    const q = query.trim();
    const regex = new RegExp(`(${q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
    const parts = text.split(regex);
    return parts.map((part, i) =>
      regex.test(part) ? (
        <mark key={i} className="search-highlight bg-accent/30 text-accent font-bold px-0.5 rounded">
          {part}
        </mark>
      ) : (
        part
      )
    );
  };

  // Pinned messages list
  const pinnedMessages = useMemo(() => {
    return messages.filter((m) => pinnedMessageIds.includes(m.id));
  }, [messages, pinnedMessageIds]);

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
          {/* In-Chat Message Search Toggle */}
          <button
            type="button"
            className={`cyber-btn btn-icon ${isChatSearchOpen ? 'bg-accent/20 text-accent' : ''}`}
            onClick={() => {
              setIsChatSearchOpen(!isChatSearchOpen);
              if (isChatSearchOpen) setChatSearchQuery('');
            }}
            title="Search in conversation"
          >
            <Search size={15} />
          </button>

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

      {/* In-Chat Search Bar Toolbar */}
      {isChatSearchOpen && (
        <div className="flex items-center gap-2 px-3 py-2 bg-bg-card border-b border-border text-xs z-10 animate-fadeIn">
          <Search size={14} className="text-accent flex-shrink-0" />
          <input
            type="text"
            autoFocus
            placeholder="Search conversation..."
            className="cyber-input py-1 text-xs flex-1"
            value={chatSearchQuery}
            onChange={(e) => {
              setChatSearchQuery(e.target.value);
              setCurrentMatchIndex(0);
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                jumpToMatch(currentMatchIndex + (e.shiftKey ? -1 : 1));
              } else if (e.key === 'Escape') {
                setIsChatSearchOpen(false);
                setChatSearchQuery('');
              }
            }}
          />
          <span className="text-muted font-mono text-[11px] whitespace-nowrap">
            {chatSearchQuery.trim()
              ? `${searchMatches.length === 0 ? 0 : currentMatchIndex + 1}/${searchMatches.length}`
              : '0 matches'}
          </span>
          <button
            type="button"
            className="cyber-btn btn-icon p-1"
            disabled={searchMatches.length === 0}
            onClick={() => jumpToMatch(currentMatchIndex - 1)}
            title="Previous match (Shift+Enter)"
          >
            <ChevronUp size={14} />
          </button>
          <button
            type="button"
            className="cyber-btn btn-icon p-1"
            disabled={searchMatches.length === 0}
            onClick={() => jumpToMatch(currentMatchIndex + 1)}
            title="Next match (Enter)"
          >
            <ChevronDown size={14} />
          </button>
          <button
            type="button"
            className="cyber-btn btn-icon p-1 text-muted hover:text-danger"
            onClick={() => {
              setIsChatSearchOpen(false);
              setChatSearchQuery('');
            }}
            title="Close (Esc)"
          >
            <X size={14} />
          </button>
        </div>
      )}

      {/* Pinned Messages Header Banner */}
      {pinnedMessages.length > 0 && (
        <div className="flex items-center justify-between px-3 py-1.5 bg-bg-card/90 border-b border-accent/30 text-xs z-10 backdrop-blur-sm">
          <div
            className="flex items-center gap-2 overflow-hidden flex-1 cursor-pointer"
            onClick={() => jumpToMessage(pinnedMessages[0].id)}
          >
            <Pin size={12} className="text-accent fill-accent flex-shrink-0" />
            <span className="text-[10px] font-bold text-accent font-mono tracking-wider flex-shrink-0">
              PINNED //
            </span>
            <span className="truncate text-text-main text-[11px]">
              {pinnedMessages[0].text || pinnedMessages[0].fileName || 'Encrypted Payload'}
            </span>
            {pinnedMessages.length > 1 && (
              <span className="text-[10px] text-muted font-mono ml-1">
                +{pinnedMessages.length - 1} more
              </span>
            )}
          </div>
          <div className="flex items-center gap-1.5 ml-2">
            <button
              type="button"
              className="cyber-btn text-[10px] py-0.5 px-2 font-mono text-accent"
              onClick={() => jumpToMessage(pinnedMessages[0].id)}
            >
              JUMP
            </button>
            <button
              type="button"
              className="cyber-btn btn-icon text-muted hover:text-danger p-1"
              onClick={() => togglePinMessage(pinnedMessages[0].id)}
              title="Unpin from conversation"
            >
              <X size={12} />
            </button>
          </div>
        </div>
      )}

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
            const isPinned = pinnedMessageIds.includes(msg.id);

            return (
              <div
                key={msg.id}
                id={`msg-${msg.id}`}
                className={`message-row ${isUser ? 'sent' : 'received'} transition-all duration-300`}
              >
                <div className={`message-bubble ${isUser ? 'user-bubble' : 'contact-bubble'} ${isPinned ? 'border-accent/40 shadow-[0_0_8px_rgba(0,255,102,0.15)]' : ''}`}>
                  {/* Deleted message indicator */}
                  {msg.deleted ? (
                    <span className="italic text-muted text-xs">🚫 This message was deleted</span>
                  ) : (
                    <>
                      {/* Pinned indicator chip inside bubble */}
                      {isPinned && (
                        <div className="flex items-center gap-1 text-[9px] text-accent font-mono mb-1">
                          <Pin size={10} className="fill-accent" />
                          <span>PINNED ANCHOR</span>
                        </div>
                      )}

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

                      {/* Text Content with In-Chat Search Highlighting */}
                      {msg.text && !isCode && (
                        <p className="message-text whitespace-pre-wrap break-words">
                          {renderHighlightedText(msg.text, chatSearchQuery)}
                        </p>
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

                  {/* Message Meta Info: Reactions Picker, Pin, Forward, Delete & Timestamp */}
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

                      {/* Pin/Unpin action */}
                      {!msg.deleted && (
                        <button
                          type="button"
                          className={`text-[10px] ${isPinned ? 'text-accent' : 'text-muted hover:text-accent'} ml-1 transition-colors`}
                          title={isPinned ? 'Unpin message' : 'Pin message to header'}
                          onClick={() => togglePinMessage(msg.id)}
                        >
                          <Pin size={11} className={isPinned ? 'fill-accent' : ''} />
                        </button>
                      )}

                      {/* Forward action */}
                      {!msg.deleted && (
                        <button
                          type="button"
                          className="text-[10px] text-muted hover:text-accent ml-0.5 transition-colors"
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
                        <span className="message-status flex items-center">
                          {msg.status === 'read' ? (
                            <span title="Read by recipient" className="flex items-center text-accent">
                              <CheckCheck size={13} className="drop-shadow-[0_0_4px_var(--accent)]" />
                            </span>
                          ) : msg.status === 'delivered' ? (
                            <span title="Delivered to peer node" className="flex items-center text-muted">
                              <CheckCheck size={13} />
                            </span>
                          ) : (
                            <span title="Dispatched to relay" className="flex items-center text-muted">
                              <Check size={13} />
                            </span>
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

        {/* Real-time Typing Bubble in conversation feed */}
        {typingStatus && (
          <div className="message-row received animate-fadeIn">
            <div className="message-bubble contact-bubble flex items-center gap-2 py-2 px-3 border border-accent/30 bg-bg-card">
              <img
                src={activeContact.avatar || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&auto=format&fit=crop&q=80'}
                alt=""
                className="w-5 h-5 rounded-full object-cover border border-accent/40"
              />
              <div className="flex items-center gap-1 py-0.5">
                <span className="w-1.5 h-1.5 bg-accent rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                <span className="w-1.5 h-1.5 bg-accent rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                <span className="w-1.5 h-1.5 bg-accent rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
              <span className="text-[10px] text-accent font-mono ml-1">transmitting packets...</span>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Message Input Component */}
      <MessageInput />
    </main>
  );
};
