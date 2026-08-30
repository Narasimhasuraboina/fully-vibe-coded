import React, { useState, useEffect } from 'react';
import { 
  Search, 
  UserPlus, 
  Radio, 
  Calendar, 
  Lock, 
  Unlock, 
  ShieldCheck, 
  Users, 
  Globe 
} from 'lucide-react';
import ChatItem from './ChatItem';
import { soundFX } from '../services/audioService';
import { socketService } from '../services/socketService';

const Sidebar = ({
  contacts,
  activeContact,
  onSelectContact,
  messages,
  typingStatus,
  stories,
  onOpenStory,
  onOpenSearchUsers,
  onOpenBroadcast,
  onOpenSchedule,
  gbSettings,
  onTogglePinContact,
  onUnlockSecretChats,
  isSecretUnlocked,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState('all'); // 'all' | 'unread' | 'secret'
  const [networkResults, setNetworkResults] = useState([]);

  const handleFilterChange = (filter) => {
    soundFX.playKeypress();
    if (filter === 'secret' && !isSecretUnlocked) {
      onUnlockSecretChats();
      return;
    }
    setActiveFilter(filter);
  };

  // Live network search as user types a codename
  useEffect(() => {
    const query = searchQuery.trim().toLowerCase().replace(/^@/, '');
    if (!query) {
      return;
    }

    const debounceTimer = setTimeout(() => {
      socketService.searchUsers(query, (results) => {
        // Filter out contacts already present in user's sidebar
        const notInContacts = (results || []).filter(
          (user) => !contacts.some((c) => c.tag?.toLowerCase() === user.tag?.toLowerCase())
        );
        setNetworkResults(notInContacts);
      });
    }, 250);

    return () => clearTimeout(debounceTimer);
  }, [searchQuery, contacts]);

  // Filter contacts based on search query & active tab
  const filteredContacts = contacts.filter((c) => {
    // Secret chats visibility check
    if (c.isSecret && activeFilter !== 'secret' && !isSecretUnlocked) {
      return false;
    }

    if (activeFilter === 'secret' && !c.isSecret) return false;
    if (activeFilter === 'unread' && (!c.unreadCount || c.unreadCount === 0)) return false;

    if (!searchQuery.trim()) return true;

    const query = searchQuery.toLowerCase().replace(/^@/, '');
    return (
      c.name.toLowerCase().includes(query) ||
      c.tag.toLowerCase().includes(query) ||
      (c.customStatus || '').toLowerCase().includes(query)
    );
  });

  // Sort pinned to top
  const sortedContacts = [...filteredContacts].sort((a, b) => {
    if (a.pinned === b.pinned) return 0;
    return a.pinned ? -1 : 1;
  });

  // Start chat with discovered user
  const handleStartDiscoveredChat = (user) => {
    soundFX.playSent();
    onSelectContact({
      id: user.id || `peer_${user.username.toLowerCase()}`,
      name: user.username,
      tag: user.tag,
      avatar: user.avatar,
      status: user.status || 'offline',
      lastSeen: user.lastSeen || 'offline',
      ip: user.ip || '192.168.1.x',
      pgp: 'PGP-4096-LIVE-PEER',
      unreadCount: 0,
      pinned: false,
      isSecret: false,
      disappearingTimer: 0,
      customStatus: user.customStatus || 'Registered Node',
      bio: 'Discovered operator node on private mesh relay.',
    });
    setSearchQuery('');
  };

  return (
    <aside className="sidebar">
      {/* Quick Action Top Bar */}
      <div className="sidebar-action-bar">
        <button 
          className="action-pill action-pill-primary" 
          onClick={() => { soundFX.playKeypress(); onOpenSearchUsers(); }}
          title="Search Users by Codename (No Phone Numbers)"
        >
          <UserPlus size={13} className="text-accent" />
          <span>FIND USER</span>
        </button>

        <button 
          className="action-pill" 
          onClick={() => { soundFX.playKeypress(); onOpenBroadcast(); }}
          title="Mass Message Broadcast Blaster"
        >
          <Radio size={13} />
          <span>BROADCAST</span>
        </button>

        <button 
          className="action-pill" 
          onClick={() => { soundFX.playKeypress(); onOpenSchedule(); }}
          title="Schedule Message to send later"
        >
          <Calendar size={13} />
          <span>SCHEDULE</span>
        </button>
      </div>

      {/* Stories / Status Row */}
      <div className="stories-section">
        <div className="stories-header">
          <span>STATUS FEED</span>
          {gbSettings.antiDeleteStatus && (
            <span className="anti-revoke-tag" title="Anti-Delete Status Engine is Active">
              <ShieldCheck size={11} /> ANTI-DELETE
            </span>
          )}
        </div>
        <div className="stories-scroll">
          {/* User's own add status */}
          <div className="story-item my-story" onClick={() => onOpenStory('my_status')}>
            <div className="story-ring user-ring">
              <div className="story-add-badge">+</div>
              <img 
                src="https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&auto=format&fit=crop&q=80" 
                alt="My Status" 
                className="story-avatar" 
              />
            </div>
            <span className="story-name">My Intel</span>
          </div>

          {/* Contacts Stories */}
          {stories.map((story) => (
            <div 
              key={story.id} 
              className={`story-item ${story.isAntiRevoke ? 'has-revoked' : ''}`}
              onClick={() => onOpenStory(story.id)}
            >
              <div className={`story-ring ${story.isAntiRevoke ? 'ring-revoked' : 'ring-active'}`}>
                <img src={story.avatar} alt={story.contactName} className="story-avatar" />
              </div>
              <span className="story-name">
                {story.contactName}
                {story.isAntiRevoke && <span className="revoked-dot" title="Story was deleted but saved by GB-Engine">●</span>}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Search Input */}
      <div className="sidebar-search-box">
        <Search size={15} className="search-icon" />
        <input 
          type="text" 
          placeholder="Type @username to find anyone..."
          value={searchQuery}
          onChange={(e) => {
            const val = e.target.value;
            setSearchQuery(val);
            if (!val.trim()) {
              setNetworkResults([]);
            }
          }}
          className="search-input"
        />
        {searchQuery && (
          <button 
            className="clear-search-btn" 
            onClick={() => {
              setSearchQuery('');
              setNetworkResults([]);
            }}
          >
            ×
          </button>
        )}
      </div>

      {/* Filter Tabs */}
      <div className="sidebar-filter-tabs">
        <button 
          className={`tab-btn ${activeFilter === 'all' ? 'active' : ''}`}
          onClick={() => handleFilterChange('all')}
        >
          CONVERSATIONS ({contacts.length})
        </button>

        <button 
          className={`tab-btn ${activeFilter === 'unread' ? 'active' : ''}`}
          onClick={() => handleFilterChange('unread')}
        >
          UNREAD
        </button>

        <button 
          className={`tab-btn ${activeFilter === 'secret' ? 'active' : ''}`}
          onClick={() => handleFilterChange('secret')}
        >
          {isSecretUnlocked ? <Unlock size={12} /> : <Lock size={12} />}
          <span>SECRET</span>
        </button>
      </div>

      {/* Contact List */}
      <div className="contacts-list">
        
        {/* Network Discovery Results in Sidebar when searching */}
        {searchQuery.trim() && networkResults.length > 0 && (
          <div className="network-results-section">
            <div className="network-results-header">
              <Globe size={11} className="text-accent pulse-icon" />
              <span>DISCOVERED USERS ({networkResults.length})</span>
            </div>
            {networkResults.map((user) => (
              <div 
                key={user.tag}
                className="discovered-user-row"
                onClick={() => handleStartDiscoveredChat(user)}
              >
                <div className="discovered-avatar-wrap">
                  <img src={user.avatar} alt={user.username} className="discovered-avatar" />
                  <span className={`status-dot ${user.status === 'online' ? 'online' : 'offline'}`}></span>
                </div>
                <div className="discovered-info">
                  <div className="discovered-name-row">
                    <span className="disc-name">{user.username}</span>
                    <span className="disc-tag">{user.tag}</span>
                  </div>
                  <span className="disc-status">
                    {user.status === 'online' ? '● Online' : `○ Offline (${user.lastSeen || 'Mailbox ready'})`}
                  </span>
                </div>
                <button className="btn-disc-chat">
                  <UserPlus size={13} />
                  <span>CHAT</span>
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Existing Conversations */}
        {sortedContacts.length === 0 && (!searchQuery.trim() || networkResults.length === 0) ? (
          <div className="empty-contacts">
            <Users size={32} className="text-muted" />
            <p>NO ACTIVE CONVERSATIONS</p>
            <span className="sub-hint">Search any user by @username to start chatting</span>
            <button 
              className="cyber-btn btn-primary btn-sm mt-2" 
              onClick={() => { soundFX.playKeypress(); onOpenSearchUsers(); }}
            >
              <UserPlus size={13} />
              <span>FIND USER BY @CODENAME</span>
            </button>
          </div>
        ) : (
          sortedContacts.map((contact) => {
            const thread = messages[contact.id] || [];
            const lastMsg = thread[thread.length - 1];
            const isTyping = typingStatus[contact.id];

            return (
              <ChatItem
                key={contact.id}
                contact={contact}
                isActive={activeContact?.id === contact.id}
                onSelect={onSelectContact}
                lastMessage={lastMsg}
                isTyping={isTyping}
                onTogglePin={onTogglePinContact}
                gbSettings={gbSettings}
              />
            );
          })
        )}
      </div>

      {/* Sidebar Footer Info */}
      <div className="sidebar-footer">
        <div className="node-info">
          <span className="dot-online"></span>
          <span>NODE: FORGE-CORE://LOCAL</span>
        </div>
        <span className="stealth-mode-label">
          {gbSettings.freezeLastSeen ? 'STEALTH ACTIVE' : 'ZERO-DIRECTORY P2P'}
        </span>
      </div>
    </aside>
  );
};

export default Sidebar;