import React, { useState, useEffect, useRef } from 'react';
import { 
  Shield, 
  Eye, 
  EyeOff, 
  Volume2, 
  VolumeX, 
  Lock, 
  Cpu, 
  Wifi, 
  Palette, 
  Tv, 
  Terminal,
  Radio,
  LogOut,
  SlidersHorizontal
} from 'lucide-react';
import { THEMES } from '../themes';
import { soundFX } from '../services/audioService';

const TopBar = ({ 
  theme, 
  setTheme, 
  gbSettings, 
  setGbSettings, 
  isInspectorOpen, 
  setIsInspectorOpen,
  onLockApp,
  myProfile,
  onOpenProfile,
  onLogout,
  isRealtimeConnected
}) => {
  const [time, setTime] = useState('');
  const [cpuUsage, setCpuUsage] = useState(28);
  const [latency, setLatency] = useState(14);
  const [themeDropdownOpen, setThemeDropdownOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const dropdownRef = useRef(null);

  useEffect(() => {
    const timer = setInterval(() => {
      const now = new Date();
      setTime(now.toISOString().replace('T', ' ').substring(0, 19) + ' UTC');
      setCpuUsage(Math.floor(20 + Math.random() * 25));
      setLatency(Math.floor(10 + Math.random() * 8));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Close menus on click outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setThemeDropdownOpen(false);
        setMobileMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('touchstart', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
    };
  }, []);

  const toggleGhostMode = () => {
    soundFX.playKeypress();
    const newGhost = !gbSettings.freezeLastSeen;
    setGbSettings(prev => ({
      ...prev,
      freezeLastSeen: newGhost,
      hideOnlineStatus: newGhost,
      hideBlueTicks: newGhost,
      hideTypingIndicator: newGhost,
    }));
  };

  const toggleAudio = () => {
    const newAudio = !gbSettings.soundEffects;
    soundFX.enabled = newAudio;
    setGbSettings(prev => ({ ...prev, soundEffects: newAudio }));
    if (newAudio) soundFX.playKeypress();
  };

  const toggleScanlines = () => {
    soundFX.playKeypress();
    setGbSettings(prev => ({ ...prev, scanlinesEnabled: !prev.scanlinesEnabled }));
  };

  const isGhost = gbSettings.freezeLastSeen && gbSettings.hideOnlineStatus;

  return (
    <header className="topbar" ref={dropdownRef}>
      <div className="topbar-left">
        <div className="brand-logo">
          <div className="pulse-indicator active"></div>
          <span className="brand-title">CHATFORGE</span>
          <span className="brand-badge hide-mobile">GB-CYBER v4.09</span>
        </div>

        {/* Realtime P2P Socket Status Tag */}
        <div className={`realtime-status-pill ${isRealtimeConnected ? 'connected' : 'offline'}`} title={isRealtimeConnected ? 'Real-time WebSocket P2P Relay Active' : 'Connecting to Relay Server...'}>
          <Radio size={12} className={isRealtimeConnected ? 'animate-pulse text-accent' : 'text-muted'} />
          <span className="hide-mobile">{isRealtimeConnected ? 'MESH ONLINE' : 'LOCAL STANDBY'}</span>
          <span className="show-mobile-inline">{isRealtimeConnected ? 'ONLINE' : 'OFFLINE'}</span>
        </div>

        <div className="sys-metric hide-mobile">
          <Cpu size={13} className="text-accent" />
          <span>CPU: {cpuUsage}%</span>
          <div className="metric-bar">
            <div className="metric-fill" style={{ width: `${cpuUsage}%` }}></div>
          </div>
        </div>

        <div className="sys-metric hide-mobile">
          <Wifi size={13} className="text-accent" />
          <span>LATENCY: {latency}ms</span>
        </div>

        <div className="security-tag hide-mobile">
          <Shield size={13} className="text-accent" />
          <span>RSA-4096 P2P</span>
        </div>
      </div>

      <div className="topbar-center hide-mobile">
        <div className="cyber-clock">
          <span className="clock-pulse">●</span>
          <span>{time || 'INITIALIZING_SYS_CLOCK...'}</span>
        </div>
      </div>

      <div className="topbar-right">
        {/* User Identity Profile Trigger */}
        <button 
          className="cyber-btn btn-profile-tag"
          onClick={() => { soundFX.playKeypress(); onOpenProfile(); }}
          title="Multi-Device Pairing & Operator Handle"
        >
          <img src={myProfile?.avatar} alt="Profile" className="topbar-avatar" />
          <span className="profile-handle-text">{myProfile?.username}</span>
        </button>

        {/* Desktop-only toggles */}
        {/* Ghost / Stealth Master Switch */}
        <button 
          className={`cyber-btn btn-ghost-toggle hide-on-mobile ${isGhost ? 'active' : ''}`}
          onClick={toggleGhostMode}
          title={isGhost ? 'Ghost Mode: ACTIVE (Last seen frozen, Blue ticks hidden)' : 'Ghost Mode: DISABLED'}
        >
          {isGhost ? <EyeOff size={14} /> : <Eye size={14} />}
          <span>{isGhost ? 'GHOST: ON' : 'GHOST: OFF'}</span>
        </button>

        {/* Audio FX Toggle */}
        <button 
          className={`cyber-btn btn-icon hide-on-mobile ${gbSettings.soundEffects ? 'active' : ''}`}
          onClick={toggleAudio}
          title="Toggle Cyber Sound FX"
        >
          {gbSettings.soundEffects ? <Volume2 size={15} /> : <VolumeX size={15} />}
        </button>

        {/* CRT Scanline Toggle */}
        <button 
          className={`cyber-btn btn-icon hide-on-mobile ${gbSettings.scanlinesEnabled ? 'active' : ''}`}
          onClick={toggleScanlines}
          title="Toggle CRT Scanline Overlay"
        >
          <Tv size={15} />
        </button>

        {/* Theme Picker */}
        <div className="theme-selector-wrapper">
          <button 
            className="cyber-btn btn-icon"
            onClick={() => {
              setThemeDropdownOpen(!themeDropdownOpen);
              setMobileMenuOpen(false);
            }}
            title="Change Cyberpunk Theme"
          >
            <Palette size={15} />
          </button>

          {themeDropdownOpen && (
            <div className="theme-dropdown">
              <div className="dropdown-header">CYBER THEMES</div>
              {Object.values(THEMES).map((t) => (
                <button
                  key={t.id}
                  className={`theme-option ${theme === t.id ? 'selected' : ''}`}
                  onClick={() => {
                    soundFX.playKeypress();
                    setTheme(t.id);
                    setGbSettings(prev => ({ ...prev, theme: t.id }));
                    setThemeDropdownOpen(false);
                  }}
                >
                  <span className="theme-color-preview" style={{ background: t.accent }}></span>
                  <span>{t.name}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* App Master Lock (Desktop) */}
        <button 
          className="cyber-btn btn-icon hide-on-mobile"
          onClick={() => {
            soundFX.playKeypress();
            onLockApp();
          }}
          title="Lock Terminal (App PIN Lock)"
        >
          <Lock size={15} />
        </button>

        {/* Logout (Desktop) */}
        <button 
          className="cyber-btn btn-icon hide-on-mobile"
          onClick={() => {
            soundFX.playGlitchAlarm();
            onLogout();
          }}
          title="Logout / Disconnect Node Identity"
        >
          <LogOut size={15} />
        </button>

        {/* Inspector / Console Drawer Trigger */}
        <button 
          className={`cyber-btn btn-inspector-toggle ${isInspectorOpen ? 'active' : ''}`}
          onClick={() => {
            soundFX.playKeypress();
            setIsInspectorOpen(!isInspectorOpen);
          }}
          title="Open Hacker Console & GB-Mods Inspector"
        >
          <Terminal size={15} />
          <span className="hide-mobile">CONSOLE & MODS</span>
        </button>

        {/* Mobile Quick Settings & Tools Dropdown Button */}
        <div className="mobile-tools-wrapper show-on-mobile">
          <button
            className={`cyber-btn btn-icon ${mobileMenuOpen ? 'active' : ''}`}
            onClick={() => {
              soundFX.playKeypress();
              setMobileMenuOpen(!mobileMenuOpen);
              setThemeDropdownOpen(false);
            }}
            title="Cyber Tools & Security Settings"
          >
            <SlidersHorizontal size={15} />
          </button>

          {mobileMenuOpen && (
            <div className="mobile-tools-dropdown">
              <div className="dropdown-header">CYBER MODS & TOOLS</div>
              
              <button 
                className={`mobile-tool-opt ${isGhost ? 'active' : ''}`}
                onClick={() => { toggleGhostMode(); }}
              >
                {isGhost ? <EyeOff size={14} className="text-danger" /> : <Eye size={14} />}
                <span>GHOST MODE: {isGhost ? 'ENABLED' : 'OFF'}</span>
              </button>

              <button 
                className={`mobile-tool-opt ${gbSettings.soundEffects ? 'active' : ''}`}
                onClick={() => { toggleAudio(); }}
              >
                {gbSettings.soundEffects ? <Volume2 size={14} className="text-accent" /> : <VolumeX size={14} />}
                <span>CYBER SOUND FX: {gbSettings.soundEffects ? 'ON' : 'MUTED'}</span>
              </button>

              <button 
                className={`mobile-tool-opt ${gbSettings.scanlinesEnabled ? 'active' : ''}`}
                onClick={() => { toggleScanlines(); }}
              >
                <Tv size={14} className={gbSettings.scanlinesEnabled ? 'text-accent' : ''} />
                <span>CRT SCANLINES: {gbSettings.scanlinesEnabled ? 'ON' : 'OFF'}</span>
              </button>

              <button 
                className="mobile-tool-opt"
                onClick={() => {
                  soundFX.playKeypress();
                  setMobileMenuOpen(false);
                  onLockApp();
                }}
              >
                <Lock size={14} />
                <span>LOCK TERMINAL (PIN)</span>
              </button>

              <button 
                className="mobile-tool-opt text-danger"
                onClick={() => {
                  soundFX.playGlitchAlarm();
                  setMobileMenuOpen(false);
                  onLogout();
                }}
              >
                <LogOut size={14} className="text-danger" />
                <span>LOGOUT / EXIT OPERATOR</span>
              </button>
            </div>
          )}
        </div>

      </div>
    </header>
  );
};

export default TopBar;
