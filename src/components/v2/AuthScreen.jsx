import React, { useState } from 'react';
import { ArrowRight, ShieldCheck, Eye, EyeOff, Terminal } from 'lucide-react';
import { useChat } from '../../context/useChat';
import { socketService } from '../../services/socketService';
import { soundFX } from '../../services/audioService';

const AVATAR_OPTIONS = [
  'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=150&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150&auto=format&fit=crop&q=80',
];

export const AuthScreen = () => {
  const { login } = useChat();
  const [authMode, setAuthMode] = useState('login'); // 'login' | 'register'
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [avatar, setAvatar] = useState(AVATAR_OPTIONS[0]);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    const cleanUser = username.trim().replace(/^@/, '');

    if (cleanUser.length < 2 || cleanUser.length > 32) {
      setErrorMsg('Username must be 2 to 32 characters.');
      soundFX.playGlitchAlarm();
      return;
    }

    if (!/^[a-zA-Z0-9_.-]+$/.test(cleanUser)) {
      setErrorMsg('Username can only contain letters, numbers, dots, dashes, and underscores.');
      soundFX.playGlitchAlarm();
      return;
    }

    if (!password || password.length < (authMode === 'register' ? 6 : 4)) {
      setErrorMsg(authMode === 'register' ? 'Password must be at least 6 characters.' : 'Password must be at least 4 characters.');
      soundFX.playGlitchAlarm();
      return;
    }

    if (authMode === 'register' && password !== confirmPassword) {
      setErrorMsg('Passwords do not match.');
      soundFX.playGlitchAlarm();
      return;
    }

    setErrorMsg('');
    setSuccessMsg('');
    setLoading(true);

    const payload = {
      username: cleanUser,
      password,
      avatar,
      isRegisterMode: authMode === 'register',
    };

    socketService.authenticateUser(payload, (res) => {
      setLoading(false);
      if (res && res.success) {
        soundFX.playSent();
        setSuccessMsg(authMode === 'register' ? 'ACCOUNT CREATED // INITIALIZING...' : 'ACCESS GRANTED // INITIALIZING...');
        setTimeout(() => {
          login({
            ...res.peerInfo,
            sessionToken: res.sessionToken,
          });
        }, 500);
      } else {
        soundFX.playGlitchAlarm();
        setErrorMsg(res?.error || 'Authentication rejected by relay server.');
      }
    });
  };

  return (
    <main className="login-gateway-root">
      <div className="login-card">
        {/* Terminal Header */}
        <div className="login-heading">
          <div className="login-brand">
            <Terminal size={19} />
            <h1>Welcome to Chatforge</h1>
          </div>
          <div className="login-security">
            <ShieldCheck size={14} />
            <span>Private relay</span>
          </div>
        </div>

        <p className="login-subtitle">Connect to your private, self-hosted messaging workspace.</p>

        {/* Mode Switcher Tabs */}
        <div className="login-tabs">
          <button
            type="button"
            className={authMode === 'login' ? 'selected' : ''}
            onClick={() => {
              setAuthMode('login');
              setErrorMsg('');
            }}
          >
            Sign in
          </button>
          <button
            type="button"
            className={authMode === 'register' ? 'selected' : ''}
            onClick={() => {
              setAuthMode('register');
              setErrorMsg('');
            }}
          >
            Create account
          </button>
        </div>

        {/* Feedback Alerts */}
        {errorMsg && (
          <div className="login-alert error" role="alert">
            {errorMsg}
          </div>
        )}
        {successMsg && (
          <div className="login-alert success" role="status" aria-live="polite">
            {successMsg}
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="login-form">
          <div className="login-field">
            <label htmlFor="auth-username">Username</label>
            <input
              id="auth-username"
              type="text"
              maxLength={authMode === 'login' ? 128 : 32}
              autoFocus
              className="login-input"
              placeholder={authMode === 'login' ? 'Username or @user:homeserver' : 'Choose a username'}
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              disabled={loading}
              required
            />
          </div>

          <div className="login-field">
            <label htmlFor="auth-password">Password</label>
            <div className="login-password-wrap">
              <input
                id="auth-password"
                type={showPassword ? 'text' : 'password'}
                className="login-input"
                placeholder={authMode === 'register' ? 'At least 10 characters' : 'Enter your password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={loading}
                required
              />
              <button
                type="button"
                className="password-toggle"
                onClick={() => setShowPassword(!showPassword)}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
              </button>
            </div>
          </div>

          {authMode === 'register' && (
            <>
              <div className="login-field">
                <label htmlFor="auth-confirm-password">Confirm password</label>
                <input
                  id="auth-confirm-password"
                  type={showPassword ? 'text' : 'password'}
                  className="login-input"
                  placeholder="Enter your password again"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  disabled={loading}
                  required
                />
              </div>

              <div className="login-field">
                <label>Select an avatar</label>
                <div className="avatar-options">
                  {AVATAR_OPTIONS.map((imgUrl) => (
                    <img
                      key={imgUrl}
                      src={imgUrl}
                      alt={`Avatar option ${AVATAR_OPTIONS.indexOf(imgUrl) + 1}`}
                      aria-label={`Use avatar ${AVATAR_OPTIONS.indexOf(imgUrl) + 1}`}
                      aria-pressed={avatar === imgUrl}
                      className={`avatar-option ${avatar === imgUrl ? 'selected' : ''}`}
                      onClick={() => setAvatar(imgUrl)}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter' || event.key === ' ') setAvatar(imgUrl);
                      }}
                    />
                  ))}
                </div>
              </div>
            </>
          )}

          <button
            type="submit"
            disabled={loading}
            className="login-submit"
          >
            {loading ? (
              <span>AUTHENTICATING PROTOCOL...</span>
            ) : (
              <>
                <span>{authMode === 'register' ? 'Create account' : 'Sign in'}</span>
                <ArrowRight size={16} />
              </>
            )}
          </button>
        </form>
        <p className="login-footer">Your conversations are waiting.</p>
      </div>
    </main>
  );
};
