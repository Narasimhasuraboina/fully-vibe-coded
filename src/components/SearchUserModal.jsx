import React, { useState, useEffect } from 'react';
import { Search, UserPlus, X, MessageSquare, Shield, Lock, Radio } from 'lucide-react';
import { soundFX } from '../services/audioService';
import { socketService } from '../services/socketService';

const SearchUserModal = ({ currentProfile, onSelectAndAddContact, onClose, existingContacts = [] }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);

  useEffect(() => {
    const query = searchQuery.trim().toLowerCase().replace(/^@/, '');
    if (!query) return;

    const debounceTimer = setTimeout(() => {
      setIsSearching(true);
      socketService.searchUsers(query, (results) => {
        // Filter out self
        const filtered = (results || []).filter(u => u.tag !== currentProfile?.tag);
        setSearchResults(filtered);
        setIsSearching(false);
      });
    }, 150);

    return () => clearTimeout(debounceTimer);
  }, [searchQuery, currentProfile?.tag]);

  const handleStartChat = (user) => {
    soundFX.playSent();
    onSelectAndAddContact({
      id: user.id || `peer_${user.username.toLowerCase()}`,
      name: user.username,
      tag: user.tag,
      avatar: user.avatar,
      status: user.status || 'offline',
      lastSeen: user.lastSeen || 'offline',
      ip: user.ip || '192.168.1.x',
      pgp: 'PGP-4096-VERIFIED',
      unreadCount: 0,
      pinned: false,
      isSecret: false,
      disappearingTimer: 0,
      customStatus: user.customStatus || 'Registered Node',
      bio: 'Discovered operator on private mesh network.',
    });
    onClose();
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="cyber-modal search-user-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title">
            <Search size={16} className="text-accent" />
            <span>LOCATE OPERATOR BY CODENAME</span>
          </div>
          <button className="btn-close" onClick={onClose}><X size={16} /></button>
        </div>

        <div className="modal-body">
          <p className="modal-description">
            To text someone, enter their exact <strong>@username</strong>. Public user lists are hidden for zero-knowledge privacy.
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
                if (!val.trim()) {
                  setSearchResults([]);
                  setIsSearching(false);
                }
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
                <p>PRIVATE NETWORK // ZERO DIRECTORY LEAKAGE</p>
                <span>Type the recipient's @username above to find them (whether they are online or offline).</span>
              </div>
            ) : isSearching ? (
              <div className="empty-search-state">
                <Radio size={32} className="text-accent pulse-icon" />
                <p>SEARCHING SECURE MESH...</p>
                <span>Scanning registered nodes for @{searchQuery.replace(/^@/, '')}...</span>
              </div>
            ) : searchResults.length === 0 ? (
              <div className="empty-search-state">
                <Shield size={32} className="text-muted" />
                <p>NO OPERATOR FOUND FOR "@{searchQuery.replace(/^@/, '')}"</p>
                <span>Make sure the person has registered with this exact username on Chatforge.</span>
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
                        <span className="user-bio">{user.customStatus || (isOnline ? 'Active on mesh' : `Last active: ${user.lastSeen || 'offline'}`)}</span>
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
