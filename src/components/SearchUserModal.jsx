import React, { useState, useEffect } from 'react';
import { Search, UserPlus, X, MessageSquare, Shield, Lock, Radio } from 'lucide-react';
import { soundFX } from '../services/audioService';
import { socketService } from '../services/socketService';
import { getContactId } from '../services/storage';
import { DEFAULT_AVATAR } from '../avatars';

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

  const handleQueryChange = (val) => {
    soundFX.playKeypress();
    setSearchQuery(val);
    if (!val.trim()) {
      setSearchResults([]);
      setIsSearching(false);
    } else {
      setIsSearching(true);
    }
  };

  useEffect(() => {
    const cleanQ = searchQuery.trim().toLowerCase().replace(/^@/, '');
    if (!cleanQ) return;

    const debounceTimer = setTimeout(() => {
      socketService.searchUsers(cleanQ, (results) => {
        // STRICT: Only operators registered in the database can be contacted
        const myTag = currentProfile?.tag?.toLowerCase();
        const validUsers = (results || []).filter(u => u && u.tag && u.tag.toLowerCase() !== myTag);
        setSearchResults(validUsers);
        setIsSearching(false);
      });
    }, 150);

    return () => clearTimeout(debounceTimer);
  }, [searchQuery, currentProfile?.tag]);

  const handleStartChat = (user) => {
    soundFX.playSent();
    const cleanTag = user.tag?.startsWith('@') ? user.tag : `@${user.tag || user.username.toLowerCase()}`;
    onSelectAndAddContact({
      id: user.id || getContactId(cleanTag),
      name: user.username,
      tag: cleanTag,
      avatar: user.avatar || DEFAULT_AVATAR,
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
            Enter an operator's <strong>@username</strong> to start a conversation. Only <strong>registered</strong> operators in the database will be found.
          </p>

          <div className="search-input-box">
            <Search size={15} className="text-accent search-icon" />
            <input
              type="text"
              placeholder="Enter exact codename (e.g. shadow, neo, cipher)..."
              value={searchQuery}
              onChange={(e) => handleQueryChange(e.target.value)}
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
                <span>Type the recipient's @username above to search the registered database.</span>
              </div>
            ) : isSearching ? (
              <div className="empty-search-state">
                <Radio size={32} className="text-accent pulse-icon" />
                <p>SEARCHING REGISTERED NODES...</p>
                <span>Scanning database for @{cleanQuery}...</span>
              </div>
            ) : searchResults.length === 0 ? (
              <div className="empty-search-state">
                <Shield size={32} className="text-muted" />
                <p className="font-bold">NO REGISTERED OPERATOR FOUND</p>
                <span>No account registered under "@{cleanQuery}". Only operators registered in the database can be contacted.</span>
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
