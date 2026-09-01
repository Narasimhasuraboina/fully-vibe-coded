import React, { useState, useRef, useEffect } from 'react';
import { Terminal, Shield, LogOut, Palette, ChevronDown, Check } from 'lucide-react';
import { useChat } from '../../context/useChat';
import { THEMES } from '../../themes';

export const Header = () => {
  const { currentUser, logout, theme, setTheme, isConnected, serverInfo } = useChat();
  const [showThemePicker, setShowThemePicker] = useState(false);
  const dropdownRef = useRef(null);

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

      {/* Right Controls: Theme Picker & Profile */}
      <div className="topbar-right">
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

        {/* User Profile Pill */}
        {currentUser && (
          <div className="flex items-center gap-2">
            <div className="cyber-btn btn-profile-tag" title={`Logged in as ${currentUser.username}`}>
              <img
                src={currentUser.avatar || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&auto=format&fit=crop&q=80'}
                alt={currentUser.username}
                className="topbar-avatar"
              />
              <span className="profile-handle-text">{currentUser.tag || `@${currentUser.username}`}</span>
            </div>

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
