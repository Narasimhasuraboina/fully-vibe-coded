import React, { useState, useEffect } from 'react';
import { Search, UserPlus, X, MessageSquare, Shield, Lock, Radio } from 'lucide-react';
import { soundFX } from '../services/audioService';
import { socketService } from '../services/socketService';
import { getContactId } from '../services/storage';

const SearchUserModal = ({ currentProfile, onSelectAndAddContact, onClose, existingContacts = [] }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  useEffect(() => {
    const cleanQ = searchQuery.trim().toLowerCase().replace(/^@/, '');
    if (!cleanQ) return;

    const debounceTimer = setTimeout(() => {
      setIsSearching(true);
      socketService.searchUsers(cleanQ, (results) => {
        // Also query known local contacts
        const localMatches = (existingContacts || []).filter(c => /^@[A-Za-z0-9._=/-]+(:[A-Za-z0-9.-]+(?::\d+)?)?$/.test(c.tag || '') && (
          (c.name && c.name.toLowerCase().includes(cleanQ)) ||
          (c.tag && c.tag.toLowerCase().includes(cleanQ))
        )).map(c => ({
          username: c.name,
          tag: c.tag,
          avatar: c.avatar,
          status: c.status || 'offline',
          lastSeen: c.lastSeen || 'offline',
          customStatus: c.customStatus || 'Known Contact',
        }));

        // Combine server results + local contacts (deduplicate by tag)
        const combinedMap = new Map();
        (results || []).forEach(u => {
          if (u && u.tag) combinedMap.set(u.tag.toLowerCase(), u);
        });
        localMatches.forEach(u => {
          if (u && u.tag && !combinedMap.has(u.tag.toLowerCase())) {
            combinedMap.set(u.tag.toLowerCase(), u);
          }
        });

        // Filter out self
        const myTag = currentProfile?.tag?.toLowerCase();
        const filtered = Array.from(combinedMap.values()).filter(u => u.tag?.toLowerCase() !== myTag);

        setSearchResults(filtered);
        setIsSearching(false);
      });
    }, 100);

    return () => clearTimeout(debounceTimer);
  }, [searchQuery, currentProfile?.tag, existingContacts]);

  const handleStartChat = (user) => {
    soundFX.playSent();
    const cleanTag = user.tag?.startsWith('@') ? user.tag : `@${user.tag || user.username.toLowerCase()}`;
    onSelectAndAddContact({
      id: user.id || getContactId(cleanTag),
      name: user.username,
      tag: cleanTag,
      avatar: user.avatar || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&auto=format&fit=crop&q=80',
      status: user.status || 'offline',
      lastSeen: user.lastSeen || 'offline',
      ip: user.ip || '192.168.1.x',
      pgp: 'PGP-4096-VERIFIED',
      unreadCount: 0,
      pinned: false,
      isSecret: false,
      disappearingTimer: 0,
      customStatus: user.customStatus || (user.status === 'online' ? 'Active on mesh' : 'Registered Offline Node'),
      bio: 'Discovered operator on private mesh network.',
    });
    onClose();
  };

  const cleanQuery = searchQuery.trim().replace(/^@/, '');
  const explicitTag = searchQuery.trim().startsWith('@') ? searchQuery.trim() : `@${searchQuery.trim()}`;
  const canOpenExplicitId = /^@[A-Za-z0-9._=/-]+(:[A-Za-z0-9.-]+(?::\d+)?)?$/.test(explicitTag)
    && explicitTag.toLowerCase() !== currentProfile?.tag?.toLowerCase()
    && !searchResults.some((user) => user.tag?.toLowerCase() === explicitTag.toLowerCase());

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div 
        className="cyber-modal search-user-modal" 
        role="dialog" 
        aria-modal="true" 
        aria-labelledby="search-modal-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-header">
          <div className="modal-title" id="search-modal-title">
            <Search size={16} className="text-accent" />
            <span>LOCATE OPERATOR BY CODENAME</span>
          </div>
          <button type="button" className="btn-close" onClick={onClose} aria-label="Close search modal"><X size={16} /></button>
        </div>

        <div className="modal-body">
          <p className="modal-description">
            Enter an operator's <strong>@username</strong> to start a conversation. Works for both <strong>online</strong> and <strong>offline</strong> registered peers.
          </p>

          <div className="search-input-box">
            <Search size={15} className="text-accent search-icon" />
            <input
              type="text"
              placeholder="Enter exact codename (e.g. shadow, neo, cipher)..."
              value={searchQuery}
              onChange={(e) => {
                soundFX.playKeypress();
                const val = e.target.value;
                setSearchQuery(val);
              }}
              autoFocus
              className="cyber-input search-input-field"
            />
            {searchQuery && (
              <button 
                className="clear-btn" 
                onClick={() => {
                  setSearchQuery('');
                  setSearchResults([]);
                  setIsSearching(false);
                }}
              >
                ×
              </button>
            )}
          </div>

          <div className="search-results-container">
            {!searchQuery.trim() ? (
              <div className="empty-search-state">
                <Lock size={34} className="text-accent pulse-icon" />
                <p>ZERO DIRECTORY LEAKAGE // PRIVATE LOOKUP</p>
                <span>Type the recipient's @username above to find them (whether they are online or offline).</span>
              </div>
            ) : isSearching ? (
              <div className="empty-search-state">
                <Radio size={32} className="text-accent pulse-icon" />
                <p>SEARCHING REGISTERED NODES...</p>
                <span>Scanning network directory for @{cleanQuery}...</span>
              </div>
            ) : searchResults.length === 0 ? (
              <div className="empty-search-state">
                <Shield size={32} className="text-accent" />
                <p>NO OPERATOR FOUND</p>
                <span>No matching operator was found on this relay server. Verify the codename or open direct frequency below.</span>
                {canOpenExplicitId && (
                  <button
                    type="button"
                    className="cyber-btn btn-secondary btn-sm"
                    style={{ marginTop: '12px', width: '100%' }}
                    onClick={() => handleStartChat({ username: cleanQuery, tag: explicitTag, id: explicitTag, status: 'offline' })}
                  >
                    <MessageSquare size={13} />
                    <span>OPEN {explicitTag}</span>
                  </button>
                )}
              </div>
            ) : (
              <div className="results-list">
                <div className="results-header">
                  <span>FOUND OPERATORS ({searchResults.length})</span>
                </div>
                {searchResults.map((user) => {
                  const isAlreadyAdded = existingContacts.some(c => c.tag?.toLowerCase() === user.tag?.toLowerCase());
                  const isOnline = user.status === 'online';

                  return (
                    <div key={user.tag} className="user-result-card">
                      <div className="user-avatar-wrap">
                        <img src={user.avatar} alt={user.username} className="result-avatar" />
                        <span className={`status-dot ${isOnline ? 'online' : 'offline'}`}></span>
                      </div>

                      <div className="user-info-wrap">
                        <div className="user-name-line">
                          <span className="user-name">{user.username}</span>
                          <span className="user-tag">{user.tag}</span>
                          <span className={`status-pill ${isOnline ? 'status-online' : 'status-offline'}`}>
                            {isOnline ? '● ONLINE' : '○ OFFLINE (MAILBOX READY)'}
                          </span>
                        </div>
                        <span className="user-bio">{user.customStatus || (isOnline ? 'Active on mesh' : `Last seen: ${user.lastSeen || 'offline'}`)}</span>
                      </div>

                      <button
                        className={`cyber-btn ${isAlreadyAdded ? 'btn-secondary' : 'btn-primary'} btn-sm`}
                        onClick={() => handleStartChat(user)}
                      >
                        {isAlreadyAdded ? (
                          <>
                            <MessageSquare size={12} />
                            <span>OPEN CHAT</span>
                          </>
                        ) : (
                          <>
                            <UserPlus size={12} />
                            <span>CHAT NOW</span>
                          </>
                        )}
                      </button>
                    </div>
                  );
                })}

              </div>
            )}
          </div>

          <div className="modal-footer-actions">
            <button type="button" className="cyber-btn btn-secondary" onClick={onClose}>
              CLOSE
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SearchUserModal;
