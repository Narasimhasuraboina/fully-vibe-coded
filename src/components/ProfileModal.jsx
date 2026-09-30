import React, { useState, useEffect } from 'react';
import { User, X, Check, Globe } from 'lucide-react';
import { soundFX } from '../services/audioService';

const PRESET_AVATARS = [
  'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=150&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150&auto=format&fit=crop&q=80',
];

const ProfileModal = ({ currentProfile, onSaveProfile, onClose, serverInfo }) => {
  const username = currentProfile?.username || currentProfile?.name || 'Operator_Zero';
  const [avatar, setAvatar] = useState(currentProfile?.avatar || PRESET_AVATARS[0]);
  const [customStatus, setCustomStatus] = useState(currentProfile?.customStatus || 'Active Node on Mesh Network');
  const appAddress = window.location.protocol === 'https:'
    ? window.location.origin
    : `http://${serverInfo?.localIP || window.location.hostname}:${serverInfo?.port || 3001}`;

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!username.trim()) return;

    soundFX.playSent();
    onSaveProfile({
      ...currentProfile,
      avatar,
      customStatus: customStatus.trim(),
    });
    onClose();
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="cyber-modal" role="dialog" aria-modal="true" aria-labelledby="profile-dialog-title" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title">
            <User size={16} className="text-accent" />
            <span id="profile-dialog-title">Profile and device access</span>
          </div>
          <button type="button" className="btn-close" onClick={onClose} aria-label="Close profile modal"><X size={16} /></button>
        </div>

        <div className="modal-body">
          {/* Multi-Device LAN Pairing Intel */}
          <div className="lan-pairing-box">
            <div className="lan-title">
              <Globe size={14} className="text-accent" />
              <span>REAL-TIME MULTI-DEVICE ACCESS</span>
            </div>
            <p className="lan-desc">
              Open this application on any second device (phone, laptop, tablet) on your local Wi-Fi / network to chat in real-time:
            </p>
            <div className="lan-url-badge">
              <span>{appAddress}</span>
            </div>
          </div>

          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label>Choose an avatar</label>
              <div className="avatar-picker-row">
                {PRESET_AVATARS.map((url, idx) => (
                  <img
                    key={idx}
                    src={url}
                    alt={`Avatar option ${idx + 1}`}
                    className={`pick-avatar ${avatar === url ? 'selected' : ''}`}
                    role="button"
                    tabIndex={0}
                    aria-label={`Choose avatar ${idx + 1}`}
                    aria-pressed={avatar === url}
                    onClick={() => { soundFX.playKeypress(); setAvatar(url); }}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault();
                        setAvatar(url);
                      }
                    }}
                  />
                ))}
              </div>
            </div>

            <div className="form-group">
              <label htmlFor="profile-username">Username</label>
              <input
                id="profile-username"
                type="text"
                value={username}
                readOnly
                title="Username changes require creating a new account."
                className="cyber-input"
              />
            </div>

            <div className="form-group">
              <label htmlFor="profile-status">Custom status</label>
              <input
                id="profile-status"
                type="text"
                maxLength={140}
                value={customStatus}
                onChange={(e) => setCustomStatus(e.target.value)}
                placeholder="Status / Bio broadcasted to peers"
                className="cyber-input"
              />
            </div>

            <div className="modal-footer-actions">
              <button type="button" className="cyber-btn btn-secondary" onClick={onClose}>
                CANCEL
              </button>
              <button type="submit" className="cyber-btn btn-primary">
                <Check size={14} /> SAVE & BROADCAST IDENTITY
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default ProfileModal;
