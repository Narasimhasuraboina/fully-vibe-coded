import React, { useState, useRef, useEffect } from 'react';
import { Terminal, Shield, LogOut, Palette, ChevronDown, Check, Radio, Calendar, Volume2, VolumeX } from 'lucide-react';
import { useChat } from '../../context/useChat';
import { THEMES } from '../../themes';

export const Header = () => {
  const { 
    currentUser, 
    logout, 
    theme, 
    setTheme, 
    isConnected, 
    serverInfo,
    openModal,
    scheduledMessages,
    isSoundMuted,
    toggleSoundMute,
  } = useChat();
  const [showThemePicker, setShowThemePicker] = useState(false);
  const dropdownRef = useRef(null);

  const pendingScheduledCount = scheduledMessages.filter(s => s.status === 'pending').length;

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setShowThemePicker(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <header className="topbar">
      {/* Brand & Logo */}
      <div className="topbar-left">
        <div className="brand-logo">
          <Terminal size={18} className="text-accent" />
          <span className="brand-title">CHATFORGE</span>
          <span className="brand-badge">V2</span>
        </div>

        {/* Real-time Status Indicator */}
        <div className={`realtime-status-pill ${isConnected ? 'connected' : 'offline'}`}>
          <span className="pulse-indicator" />
          <span>{isConnected ? 'NODE: ONLINE' : 'NODE: OFFLINE'}</span>
        </div>
      </div>

      {/* Center Server Info */}
      <div className="topbar-center hidden md:flex">
        <div className="security-tag">
          <Shield size={12} />
          <span>E2EE // AES-256-GCM</span>
        </div>
        <span className="text-muted text-xs">PORT {serverInfo.port || 3001}</span>
      </div>

      {/* Right Controls: Quick Tools, Theme Picker & Profile */}
      <div className="topbar-right">
        {/* Mass Broadcast Blaster Action */}
        <button
          type="button"
          className="cyber-btn"
          onClick={() => openModal('broadcast')}
          title="Mass Broadcast Blaster"
        >
          <Radio size={14} className="text-accent" />
          <span className="hidden sm:inline">BROADCAST</span>
        </button>

        {/* Scheduled Dispatcher Action */}
        <button
          type="button"
          className="cyber-btn relative"
          onClick={() => openModal('schedule')}
          title="Scheduled Transmissions"
        >
          <Calendar size={14} className="text-accent" />
          <span className="hidden sm:inline">SCHEDULE</span>
          {pendingScheduledCount > 0 && (
            <span className="unread-badge animate-pulse" style={{ position: 'relative', top: 'auto', right: 'auto', marginLeft: '4px' }}>
              {pendingScheduledCount}
            </span>
          )}
        </button>

        {/* 12-Theme Selector Dropdown */}
        <div className="theme-selector-wrapper" ref={dropdownRef}>
          <button
            type="button"
            className="cyber-btn"
            onClick={() => setShowThemePicker(!showThemePicker)}
            title="Switch Theme"
          >
            <Palette size={14} />
            <span className="hidden sm:inline">THEME</span>
            <ChevronDown size={12} />
          </button>

          {showThemePicker && (
            <div className="theme-dropdown">
              <div className="theme-dropdown-header">CYBER THEMES (12)</div>
              <div className="theme-dropdown-list">
                {Object.values(THEMES).map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    className={`theme-option ${theme === t.id ? 'selected' : ''}`}
                    onClick={() => {
                      setTheme(t.id);
                      setShowThemePicker(false);
                    }}
                  >
                    <span className="theme-color-preview" style={{ background: t.accent }} />
                    <span className="theme-name-text">{t.name}</span>
                    {theme === t.id && <Check size={14} className="text-accent" />}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Sound FX Toggle */}
        <button
          type="button"
          className="cyber-btn btn-icon"
          onClick={toggleSoundMute}
          title={isSoundMuted ? 'Sound FX: MUTED (Click to unmute)' : 'Sound FX: ACTIVE (Click to mute)'}
        >
          {isSoundMuted ? (
            <VolumeX size={15} className="text-danger" />
          ) : (
            <Volume2 size={15} className="text-accent" />
          )}
        </button>

        {/* User Profile Pill */}
        {currentUser && (
          <div className="flex items-center gap-2">
            <button
              type="button"
              className="cyber-btn btn-profile-tag"
              onClick={() => openModal('profile')}
              title={`Logged in as ${currentUser.username} - Click to view/edit identity`}
            >
              <img
                src={currentUser.avatar || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&auto=format&fit=crop&q=80'}
                alt={currentUser.username}
                className="topbar-avatar"
              />
              <span className="profile-handle-text">{currentUser.tag || `@${currentUser.username}`}</span>
            </button>

            <button
              type="button"
              className="cyber-btn btn-icon text-danger"
              onClick={logout}
              title="Disconnect / Logout"
            >
              <LogOut size={15} />
            </button>
          </div>
        )}
      </div>
    </header>
  );
};
