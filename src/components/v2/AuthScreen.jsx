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

    if (cleanUser.length < 2) {
      setErrorMsg('Codename must be at least 2 characters.');
      soundFX.playGlitchAlarm();
      return;
    }

    if (!/^[a-zA-Z0-9_]+$/.test(cleanUser)) {
      setErrorMsg('Codename can only contain letters, digits, and underscores.');
      soundFX.playGlitchAlarm();
      return;
    }

    if (!password || password.length < 4) {
      setErrorMsg('Password must be at least 4 characters.');
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
      customStatus: 'Operating on P2P Mesh',
      isRegisterMode: authMode === 'register',
    };

    socketService.authenticateUser(payload, (res) => {
      setLoading(false);
      if (res && res.success) {
        soundFX.playSent();
        setSuccessMsg(authMode === 'register' ? 'REGISTRATION SUCCESSFUL // INITIALIZING...' : 'ACCESS GRANTED // INITIALIZING...');
        setTimeout(() => {
          login({
            ...res.peerInfo,
            password,
          });
        }, 500);
      } else {
        soundFX.playGlitchAlarm();
        setErrorMsg(res?.error || 'Authentication rejected by relay server.');
      }
    });
  };

  return (
    <div className="login-gateway-root flex items-center justify-center p-4 min-h-screen">
      <div className="login-card w-full max-w-md bg-bg-card border border-border rounded-lg p-6 shadow-2xl relative">
        {/* Terminal Header */}
        <div className="flex items-center justify-between pb-4 mb-4 border-b border-border">
          <div className="flex items-center gap-2">
            <Terminal size={20} className="text-accent" />
            <span className="font-bold tracking-wider text-sm text-text-main">CHATFORGE // SECURE AUTH</span>
          </div>
          <div className="flex items-center gap-1 text-[11px] text-accent border border-border px-2 py-0.5 rounded">
            <ShieldCheck size={13} />
            <span>AES-256</span>
          </div>
        </div>

        {/* Mode Switcher Tabs */}
        <div className="flex border border-border rounded mb-4 overflow-hidden">
          <button
            type="button"
            className={`flex-1 py-2 text-xs font-bold transition-colors ${
              authMode === 'login' ? 'bg-accent text-black' : 'bg-transparent text-muted hover:text-text-main'
            }`}
            onClick={() => {
              setAuthMode('login');
              setErrorMsg('');
            }}
          >
            LOGIN
          </button>
          <button
            type="button"
            className={`flex-1 py-2 text-xs font-bold transition-colors ${
              authMode === 'register' ? 'bg-accent text-black' : 'bg-transparent text-muted hover:text-text-main'
            }`}
            onClick={() => {
              setAuthMode('register');
              setErrorMsg('');
            }}
          >
            REGISTER
          </button>
        </div>

        {/* Feedback Alerts */}
        {errorMsg && (
          <div className="p-2 mb-3 bg-danger/15 border border-danger text-danger text-xs rounded">
            {errorMsg}
          </div>
        )}
        {successMsg && (
          <div className="p-2 mb-3 bg-accent/15 border border-accent text-accent text-xs rounded">
            {successMsg}
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="block text-xs text-muted mb-1 uppercase font-semibold">Operator Codename</label>
            <input
              type="text"
              autoFocus
              className="cyber-input w-full"
              placeholder="e.g. Neo, Trinity, ZeroCool"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              disabled={loading}
              required
            />
          </div>

          <div>
            <label className="block text-xs text-muted mb-1 uppercase font-semibold">Secret Passkey</label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                className="cyber-input w-full pr-8"
                placeholder="Enter password (min 4 chars)"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={loading}
                required
              />
              <button
                type="button"
                className="absolute right-2 top-2.5 text-muted hover:text-accent"
                onClick={() => setShowPassword(!showPassword)}
              >
                {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
              </button>
            </div>
          </div>

          {authMode === 'register' && (
            <>
              <div>
                <label className="block text-xs text-muted mb-1 uppercase font-semibold">Confirm Passkey</label>
                <input
                  type={showPassword ? 'text' : 'password'}
                  className="cyber-input w-full"
                  placeholder="Re-enter password to verify"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  disabled={loading}
                  required
                />
              </div>

              <div>
                <label className="block text-xs text-muted mb-1.5 uppercase font-semibold">Select Avatar</label>
                <div className="flex gap-2 justify-between">
                  {AVATAR_OPTIONS.map((imgUrl) => (
                    <img
                      key={imgUrl}
                      src={imgUrl}
                      alt="avatar"
                      className={`w-10 h-10 rounded-full cursor-pointer object-cover border-2 transition-all ${
                        avatar === imgUrl ? 'border-accent scale-110 shadow-md' : 'border-border opacity-60 hover:opacity-100'
                      }`}
                      onClick={() => setAvatar(imgUrl)}
                    />
                  ))}
                </div>
              </div>
            </>
          )}

          <button
            type="submit"
            disabled={loading}
            className="cyber-btn w-full justify-center py-2.5 mt-4 font-bold text-xs flex items-center gap-2"
          >
            {loading ? (
              <span>AUTHENTICATING PROTOCOL...</span>
            ) : (
              <>
                <span>{authMode === 'register' ? 'CREATE SECURE IDENTITY' : 'CONNECT TO NETWORK'}</span>
                <ArrowRight size={14} />
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
};
