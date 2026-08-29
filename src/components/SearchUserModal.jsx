import React, { useState, useEffect } from 'react';
import { Search, UserPlus, X, MessageSquare, Shield } from 'lucide-react';
import { soundFX } from '../services/audioService';
import { socketService } from '../services/socketService';

const SearchUserModal = ({ currentProfile, onSelectAndAddContact, onClose, existingContacts }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);

  useEffect(() => {
    // Initial fetch of directory or search as user types
    const query = searchQuery.trim().toLowerCase().replace(/^@/, '');
    
    socketService.searchUsers(query, (results) => {
      // Filter out self
      const filtered = (results || []).filter(u => u.tag !== currentProfile.tag);
      setSearchResults(filtered);
      setIsSearching(false);
    });
  }, [searchQuery, currentProfile.tag]);

  const handleStartChat = (user) => {
    soundFX.playSent();
    onSelectAndAddContact({
      id: user.id || `peer_${user.username.toLowerCase()}`,
      name: user.username,
      tag: user.tag,
      avatar: user.avatar,
      status: user.status || 'online',
      lastSeen: user.lastSeen || 'online',
      ip: user.ip || '192.168.1.x',
      pgp: 'PGP-4096-VERIFIED',
      unreadCount: 0,
      pinned: false,
      isSecret: false,
      disappearingTimer: 0,
      customStatus: user.customStatus || 'Active Node',
      bio: 'Discovered user node on mesh network.',
    });
    onClose();
  };

  return (
    <div className="modal-backdrop">
      <div className="cyber-modal search-user-modal">
        <div className="modal-header">
          <div className="modal-title">
            <Search size={16} className="text-accent" />
            <span>DISCOVER USERS BY CODENAME</span>
          </div>
          <button className="btn-close" onClick={onClose}><X size={16} /></button>
        </div>

        <div className="modal-body">
          <p className="modal-description">
            Search for registered operators by their unique username. No phone numbers or emails required.
          </p>

          <div className="search-input-box">
            <Search size={15} className="text-accent search-icon" />
            <input
              type="text"
              placeholder="Search @username (e.g. narasimha, neo, shadow)..."
              value={searchQuery}
              onChange={(e) => {
                soundFX.playKeypress();
                setIsSearching(true);
                setSearchQuery(e.target.value);
              }}
              autoFocus
              className="cyber-input search-input-field"
            />
            {searchQuery && (
              <button className="clear-btn" onClick={() => setSearchQuery('')}>×</button>
            )}
          </div>

          <div className="search-results-container">
            <div className="results-header">
              <span>REGISTERED NODES ({searchResults.length})</span>
              {isSearching && <span className="text-accent">SCANNING MESH...</span>}
            </div>

            {searchResults.length === 0 ? (
              <div className="empty-search-state">
                <Shield size={32} className="text-muted" />
                <p>NO MATCHING OPERATOR FOUND</p>
                <span>Make sure the user has logged in on their device with that username.</span>
              </div>
            ) : (
              <div className="results-list">
                {searchResults.map((user) => {
                  const isAlreadyAdded = existingContacts.some(c => c.tag === user.tag);

                  return (
                    <div key={user.tag} className="user-result-card">
                      <div className="user-avatar-wrap">
                        <img src={user.avatar} alt={user.username} className="result-avatar" />
                        <span className={`status-dot ${user.status}`}></span>
                      </div>

                      <div className="user-info-wrap">
                        <div className="user-name-line">
                          <span className="user-name">{user.username}</span>
                          <span className="user-tag">{user.tag}</span>
                        </div>
                        <span className="user-bio">{user.customStatus}</span>
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
