import React, { useState, useEffect } from 'react';
import { Search, UserPlus, Radio, MessageSquare, X } from 'lucide-react';
import { useChat } from '../../context/useChat';
import { socketService } from '../../services/socketService';
import { soundFX } from '../../services/audioService';

export const Sidebar = () => {
  const {
    contacts,
    activeContactId,
    selectContact,
    addOrSelectContact,
    allMessages,
    typingStatus,
  } = useChat();

  const [searchQuery, setSearchQuery] = useState('');
  const [showAddPeerModal, setShowAddPeerModal] = useState(false);
  const [newPeerTag, setNewPeerTag] = useState('');
  const [networkResults, setNetworkResults] = useState([]);
  const [isSearchingNetwork, setIsSearchingNetwork] = useState(false);

  const handleSearchChange = (val) => {
    setSearchQuery(val);
    if (!val.trim()) {
      setNetworkResults([]);
      setIsSearchingNetwork(false);
    }
  };

  // Filter local contacts
  const filteredContacts = contacts.filter((contact) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase().replace(/^@/, '');
    return (
      contact.name?.toLowerCase().includes(q) ||
      contact.tag?.toLowerCase().includes(q)
    );
  });

  // Live network search as user types
  useEffect(() => {
    const q = searchQuery.trim().toLowerCase().replace(/^@/, '');
    if (!q) return;

    const timer = setTimeout(() => {
      setIsSearchingNetwork(true);
      socketService.searchUsers(q, (results) => {
        setIsSearchingNetwork(false);
        const notInLocal = (results || []).filter(
          (user) => !contacts.some((c) => c.tag?.toLowerCase() === user.tag?.toLowerCase())
        );
        setNetworkResults(notInLocal);
      });
    }, 200);

    return () => clearTimeout(timer);
  }, [searchQuery, contacts]);

  const handleStartDirectChat = (e) => {
    e.preventDefault();
    if (!newPeerTag.trim()) return;
    const cleanTag = newPeerTag.trim().startsWith('@') ? newPeerTag.trim() : `@${newPeerTag.trim()}`;
    addOrSelectContact({
      tag: cleanTag,
      name: cleanTag.replace(/^@/, ''),
      status: 'offline',
      lastSeen: 'offline',
    });
    setNewPeerTag('');
    setShowAddPeerModal(false);
    soundFX.playSent();
  };

  return (
    <aside className="sidebar">
      {/* Sidebar Controls Header */}
      <div className="sidebar-header">
        <div className="sidebar-search-box">
          <Search size={14} className="text-muted" />
          <input
            type="text"
            className="sidebar-search-input"
            placeholder="Filter nodes or search network..."
            value={searchQuery}
            onChange={(e) => handleSearchChange(e.target.value)}
          />
          {searchQuery && (
            <button
              type="button"
              className="text-muted hover:text-accent"
              onClick={() => handleSearchChange('')}
            >
              <X size={13} />
            </button>
          )}
        </div>

        <button
          type="button"
          className="cyber-btn btn-icon"
          title="Direct Comms / Add Peer"
          onClick={() => setShowAddPeerModal(true)}
        >
          <UserPlus size={15} />
        </button>
      </div>

      {/* New Peer Modal / Quick Prompt */}
      {showAddPeerModal && (
        <div className="p-3 border-b border-border bg-bg-card">
          <form onSubmit={handleStartDirectChat} className="flex gap-2">
            <input
              type="text"
              autoFocus
              className="cyber-input text-xs py-1.5 flex-1"
              placeholder="Enter peer @tag (e.g. @operator)"
              value={newPeerTag}
              onChange={(e) => setNewPeerTag(e.target.value)}
            />
            <button type="submit" className="cyber-btn text-xs py-1 px-3">
              CONNECT
            </button>
            <button
              type="button"
              className="cyber-btn btn-icon text-xs py-1 px-2"
              onClick={() => setShowAddPeerModal(false)}
            >
              <X size={13} />
            </button>
          </form>
        </div>
      )}

      {/* Contacts List */}
      <div className="sidebar-list">
        {filteredContacts.map((contact) => {
          const contactMessages = allMessages[contact.id] || [];
          const lastMsg = contactMessages[contactMessages.length - 1];
          const isSelected = activeContactId === contact.id;
          const isContactTyping = typingStatus[contact.id];

          return (
            <div
              key={contact.id}
              className={`chat-item ${isSelected ? 'active' : ''}`}
              onClick={() => selectContact(contact.id)}
            >
              {/* Avatar with Status Dot */}
              <div className="relative flex-shrink-0">
                <img
                  src={contact.avatar || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&auto=format&fit=crop&q=80'}
                  alt={contact.name}
                  className="chat-avatar"
                />
                <span
                  className={`status-dot ${
                    contact.status === 'online' ? 'online' : 'offline'
                  }`}
                />
              </div>

              {/* Chat Info */}
              <div className="chat-info">
                <div className="chat-info-top">
                  <span className="contact-name">{contact.name || contact.tag}</span>
                  {lastMsg && (
                    <span className="last-message-time">{lastMsg.timestamp}</span>
                  )}
                </div>

                <div className="chat-info-bottom">
                  <span className="last-message-text">
                    {isContactTyping ? (
                      <span className="text-accent flex items-center gap-1">
                        <Radio size={11} className="animate-pulse" /> typing...
                      </span>
                    ) : lastMsg ? (
                      lastMsg.text || (lastMsg.file ? '📁 File attachment' : 'Encrypted message')
                    ) : (
                      <span className="text-muted italic">Secure channel open</span>
                    )}
                  </span>

                  {contact.unreadCount > 0 && (
                    <span className="unread-badge">{contact.unreadCount}</span>
                  )}
                </div>
              </div>
            </div>
          );
        })}

        {/* Network Search Results Section */}
        {networkResults.length > 0 && (
          <div className="mt-2 pt-2 border-t border-border px-3">
            <div className="text-[10px] font-bold text-accent uppercase tracking-wider mb-2">
              DISCOVERED NETWORK NODES ({networkResults.length})
            </div>
            {networkResults.map((user) => (
              <div
                key={user.tag}
                className="chat-item hover:bg-bg-card-hover cursor-pointer rounded p-2 mb-1"
                onClick={() => {
                  addOrSelectContact(user);
                  setSearchQuery('');
                  setNetworkResults([]);
                }}
              >
                <img
                  src={user.avatar || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&auto=format&fit=crop&q=80'}
                  alt={user.username}
                  className="chat-avatar w-8 h-8"
                />
                <div className="chat-info ml-2">
                  <span className="contact-name text-xs">{user.username}</span>
                  <span className="text-[11px] text-accent">{user.tag}</span>
                </div>
                <UserPlus size={14} className="text-accent ml-auto" />
              </div>
            ))}
          </div>
        )}

        {/* Empty Contacts Notice */}
        {filteredContacts.length === 0 && networkResults.length === 0 && !isSearchingNetwork && (
          <div className="p-6 text-center text-muted">
            <MessageSquare size={32} className="mx-auto mb-2 opacity-30" />
            <p className="text-xs">No active nodes in frequency.</p>
            <p className="text-[11px] mt-1 text-muted">
              Click <span className="text-accent">+</span> above or search a codename to start communicating.
            </p>
          </div>
        )}
      </div>
    </aside>
  );
};
