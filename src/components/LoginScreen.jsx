import React, { useState } from 'react';
import { Lock, ArrowRight, Wifi, Eye, EyeOff, ShieldCheck, KeyRound, UserCheck, UserPlus } from 'lucide-react';
import { soundFX } from '../services/audioService';
import { socketService } from '../services/socketService';

const AVATAR_OPTIONS = [
  'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=150&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150&auto=format&fit=crop&q=80',
];

const LoginScreen = ({ onLogin, serverInfo }) => {
  const [authMode, setAuthMode] = useState('login'); // 'login' | 'register'
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [avatar, setAvatar] = useState(AVATAR_OPTIONS[0]);
  const [customStatus, setCustomStatus] = useState('Operating on Encrypted P2P Mesh');
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const handleLoginSubmit = (e) => {
    e.preventDefault();
    const cleanUser = username.trim().replace(/^@/, '');
    
    if (cleanUser.length < 2) {
      setErrorMsg('Username must be at least 2 characters.');
      soundFX.playGlitchAlarm();
      return;
    }

    if (!/^[a-zA-Z0-9_]+$/.test(cleanUser)) {
      setErrorMsg('Username can only contain letters, numbers, and underscores.');
      soundFX.playGlitchAlarm();
      return;
    }

    if (!password || password.length < 4) {
      setErrorMsg('Password must be at least 4 characters long.');
      soundFX.playGlitchAlarm();
      return;
    }

    if (authMode === 'register' && password !== confirmPassword) {
      setErrorMsg('Passwords do not match! Please verify your secret passkey.');
      soundFX.playGlitchAlarm();
      return;
    }

    setErrorMsg('');
    setSuccessMsg('');
    soundFX.playKeypress();
    setIsAuthenticating(true);

    const authPayload = {
      username: cleanUser,
      password,
      avatar,
      customStatus: customStatus.trim() || 'Online Node',
      isRegisterMode: authMode === 'register',
    };

    // Authenticate securely with backend relay server
    socketService.authenticateUser(authPayload, (res) => {
      setIsAuthenticating(false);

      if (res && res.success) {
        soundFX.playSent();
        setSuccessMsg(authMode === 'register' ? 'NEW OPERATOR REGISTERED! INITIALIZING...' : 'PASSKEY VERIFIED! ACCESS GRANTED...');
        
        setTimeout(() => {
          onLogin({
            ...res.peerInfo,
            password, // Saved in local state for seamless re-authentication
          });
        }, 600);
      } else {
        soundFX.playGlitchAlarm();
        setErrorMsg(res?.error || 'AUTHENTICATION FAILED: Server rejected credentials.');
      }
    });
  };

  return (
    <div className="login-gateway-root">
      <div className="login-matrix-glow"></div>
      
      <div className="login-terminal-card">
        {/* Terminal Header */}
        <div className="login-card-header">
          <div className="terminal-dots">
            <span className="dot dot-red"></span>
            <span className="dot dot-yellow"></span>
            <span className="dot dot-green"></span>
          </div>
          <span className="terminal-sys-title">CHATFORGE // SECURE AUTH GATEWAY</span>
          <div className="terminal-enc-badge">
            <ShieldCheck size={12} className="text-accent" />
            <span>SHA-256 ENCRYPTED</span>
          </div>
        </div>

        {/* Terminal Body */}
        <div className="login-card-body">
          <div className="login-brand-banner">
            <div className="pulse-indicator active"></div>
            <h1>CHATFORGE OS</h1>
            <p className="sub-title">ZERO-KNOWLEDGE AUTHENTICATED P2P ENCLAVE</p>
          </div>

          {/* Auth Mode Toggle Tabs */}
          <div className="auth-mode-switch-tabs">
            <button
              type="button"
              className={`auth-mode-tab ${authMode === 'login' ? 'active' : ''}`}
              onClick={() => {
                soundFX.playKeypress();
                setAuthMode('login');
                setErrorMsg('');
                setSuccessMsg('');
              }}
            >
              <UserCheck size={14} />
              <span>AUTHENTICATE (LOGIN)</span>
            </button>

            <button
              type="button"
              className={`auth-mode-tab ${authMode === 'register' ? 'active' : ''}`}
              onClick={() => {
                soundFX.playKeypress();
                setAuthMode('register');
                setErrorMsg('');
                setSuccessMsg('');
              }}
            >
              <UserPlus size={14} />
              <span>NEW OPERATOR (REGISTER)</span>
            </button>
          </div>

          <div className="login-instructions">
            <p>
              {authMode === 'login'
                ? '[LOGIN PROTOCOL]: Enter your registered operator username and secret cipher passkey to unlock your secure terminal.'
                : '[REGISTRATION PROTOCOL]: Claim your unique operator username and set a secure cipher passkey to prevent impersonation.'}
            </p>
          </div>

          {errorMsg && (
            <div className="login-error-alert">
              <span>! {errorMsg}</span>
            </div>
          )}

          {successMsg && (
            <div className="login-success-alert">
              <span>✓ {successMsg}</span>
            </div>
          )}

          <form onSubmit={handleLoginSubmit} className="login-form">
            
            {/* Avatar Selector (Only for registration) */}
            {authMode === 'register' && (
              <div className="form-field-group">
                <label>SELECT OPERATOR GLYPH:</label>
                <div className="login-avatar-grid">
                  {AVATAR_OPTIONS.map((imgUrl, i) => (
                    <img
                      key={i}
                      src={imgUrl}
                      alt={`Avatar ${i}`}
                      className={`login-avatar-pick ${avatar === imgUrl ? 'selected' : ''}`}
                      onClick={() => { soundFX.playKeypress(); setAvatar(imgUrl); }}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Username Input */}
            <div className="form-field-group">
              <label>OPERATOR USERNAME / CODENAME:</label>
              <div className="input-with-prompt">
                <span className="input-prefix">@</span>
                <input
                  type="text"
                  placeholder="e.g. shadow_runner, neo, zero_cool"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  onKeyDown={() => soundFX.playKeypress()}
                  autoFocus
                  required
                  maxLength={20}
                  className="login-input"
                />
              </div>
            </div>

            {/* Password Input */}
            <div className="form-field-group">
              <label>SECRET CIPHER PASSKEY (PASSWORD):</label>
              <div className="input-with-prompt">
                <KeyRound size={15} className="text-accent" style={{ marginRight: '8px' }} />
                <input
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Enter secret password..."
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  onKeyDown={() => soundFX.playKeypress()}
                  required
                  className="login-input"
                />
                <button
                  type="button"
                  className="pwd-toggle-btn"
                  onClick={() => setShowPassword(!showPassword)}
                  title={showPassword ? 'Hide Passkey' : 'Show Passkey'}
                >
                  {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
            </div>

            {/* Confirm Password (Register mode only) */}
            {authMode === 'register' && (
              <div className="form-field-group">
                <label>CONFIRM CIPHER PASSKEY:</label>
                <div className="input-with-prompt">
                  <Lock size={15} className="text-accent" style={{ marginRight: '8px' }} />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    placeholder="Re-enter password to confirm..."
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    onKeyDown={() => soundFX.playKeypress()}
                    required
                    className="login-input"
                  />
                </div>
              </div>
            )}

            {/* Status MOTD (Register mode only) */}
            {authMode === 'register' && (
              <div className="form-field-group">
                <label>STATUS MOTD / BIO (OPTIONAL):</label>
                <input
                  type="text"
                  placeholder="Custom encrypted status message..."
                  value={customStatus}
                  onChange={(e) => setCustomStatus(e.target.value)}
                  onKeyDown={() => soundFX.playKeypress()}
                  className="login-input login-input-sub"
                />
              </div>
            )}

            {/* Submit / Login Button */}
            <button 
              type="submit" 
              className={`cyber-btn btn-login-submit ${isAuthenticating ? 'authenticating' : ''}`}
              disabled={isAuthenticating}
            >
              {isAuthenticating ? (
                <>
                  <span className="spinner-dot"></span>
                  <span>VERIFYING CRYPTOGRAPHIC PASSKEY...</span>
                </>
              ) : (
                <>
                  <span>{authMode === 'login' ? 'AUTHENTICATE & UNLOCK' : 'REGISTER & INITIALIZE SESSION'}</span>
                  <ArrowRight size={16} />
                </>
              )}
            </button>
          </form>

          {/* Network Pairing Intel */}
          <div className="login-lan-footer">
            <div className="lan-tag">
              <Wifi size={12} className="text-accent" />
              <span>LAN PEER ADDRESS: http://{serverInfo?.localIP || window.location.hostname}:5173</span>
            </div>
            <span className="lan-sub">Passwords protected by salted SHA-256 • Impersonation blocked</span>
          </div>

        </div>
      </div>
    </div>
  );
};

export default LoginScreen;
