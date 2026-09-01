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
  FileText
} from 'lucide-react';
import { useChat } from '../../context/useChat';
import { MessageInput } from './MessageInput';
import { EmptyState } from './EmptyState';

export const ChatArea = () => {
  const {
    activeContact,
    selectContact,
    messages,
    clearChat,
    typingStatus,
    reactMessage,
    deleteMessage,
  } = useChat();

  const [showMenu, setShowMenu] = useState(false);
  const messagesEndRef = useRef(null);

  // Auto-scroll to bottom
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages.length, typingStatus]);

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
          <div className="hidden sm:flex items-center gap-1 text-[11px] text-accent border border-border px-2 py-1 rounded">
            <ShieldCheck size={13} />
            <span>VERIFIED P2P</span>
          </div>

          <div className="relative">
            <button
              type="button"
              className="cyber-btn btn-icon"
              onClick={() => setShowMenu(!showMenu)}
            >
              <MoreVertical size={15} />
            </button>

            {showMenu && (
              <div className="absolute right-0 mt-1 w-44 bg-bg-card border border-border rounded shadow-lg z-20 py-1 text-xs">
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
            <p className="font-bold text-text-main">CHANNEL ESTABLISHED</p>
            <p className="text-[11px] text-muted mt-1">Send a transmission to begin encrypted conversation.</p>
          </div>
        ) : (
          messages.map((msg) => {
            const isUser = msg.sender === 'user';

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
                      {/* Image Attachment */}
                      {msg.file && msg.file.type?.startsWith('image/') && (
                        <div className="mb-2 rounded overflow-hidden max-w-sm">
                          <img
                            src={msg.file.data || msg.file.url}
                            alt={msg.file.name || 'attachment'}
                            className="max-h-60 rounded object-cover"
                          />
                        </div>
                      )}

                      {/* Generic File Attachment */}
                      {msg.file && !msg.file.type?.startsWith('image/') && (
                        <div className="flex items-center gap-2 p-2 mb-2 bg-black/20 rounded border border-border text-xs">
                          <FileText size={16} className="text-accent flex-shrink-0" />
                          <span className="truncate flex-1">{msg.file.name}</span>
                          <a
                            href={msg.file.data || msg.file.url}
                            download={msg.file.name}
                            className="text-accent hover:underline flex items-center gap-1"
                          >
                            <Download size={13} />
                          </a>
                        </div>
                      )}

                      {/* Text Content */}
                      {msg.text && (
                        <p className="message-text whitespace-pre-wrap break-words">{msg.text}</p>
                      )}
                    </>
                  )}

                  {/* Reactions Display */}
                  {msg.reactions && Object.keys(msg.reactions).length > 0 && (
                    <div className="flex gap-1 mt-1">
                      {Object.entries(msg.reactions).map(([emoji, count]) => (
                        <span key={emoji} className="bg-black/30 px-1.5 py-0.5 rounded text-[10px] border border-border">
                          {emoji} {count}
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Message Meta Info: Timestamp, Status Receipt & Quick Actions */}
                  <div className="message-meta flex items-center justify-between mt-1 pt-1 border-t border-white/5">
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        className="text-[10px] opacity-60 hover:opacity-100 transition-opacity"
                        title="React with flame"
                        onClick={() => reactMessage(msg.id, '🔥')}
                      >
                        🔥
                      </button>
                      <button
                        type="button"
                        className="text-[10px] opacity-60 hover:opacity-100 transition-opacity"
                        title="React with heart"
                        onClick={() => reactMessage(msg.id, '❤️')}
                      >
                        ❤️
                      </button>
                      {isUser && !msg.deleted && (
                        <button
                          type="button"
                          className="text-[10px] text-muted hover:text-danger ml-1"
                          title="Delete transmission"
                          onClick={() => deleteMessage(msg.id, true)}
                        >
                          <Trash2 size={11} />
                        </button>
                      )}
                    </div>

                    <div className="flex items-center gap-1">
                      <span className="message-time">{msg.timestamp}</span>
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
