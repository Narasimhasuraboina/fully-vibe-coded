import React, { useState } from 'react';
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
  const username = currentProfile.username || 'Operator_Zero';
  const [avatar, setAvatar] = useState(currentProfile.avatar || PRESET_AVATARS[0]);
  const [customStatus, setCustomStatus] = useState(currentProfile.customStatus || 'Active Node on Mesh Network');

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
      <div className="cyber-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title">
            <User size={16} className="text-accent" />
            <span>OPERATOR IDENTITY & MULTI-DEVICE PAIRING</span>
          </div>
          <button className="btn-close" onClick={onClose}><X size={16} /></button>
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
              <span>http://{serverInfo?.localIP || window.location.hostname}:5173</span>
            </div>
          </div>

          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label>CHOOSE AVATAR GLYPH:</label>
              <div className="avatar-picker-row">
                {PRESET_AVATARS.map((url, idx) => (
                  <img
                    key={idx}
                    src={url}
                    alt="avatar"
                    className={`pick-avatar ${avatar === url ? 'selected' : ''}`}
                    onClick={() => { soundFX.playKeypress(); setAvatar(url); }}
                  />
                ))}
              </div>
            </div>

            <div className="form-group">
              <label>OPERATOR HANDLE / USERNAME:</label>
              <input
                type="text"
                value={username}
                readOnly
                title="Username changes require creating a new account."
                className="cyber-input"
              />
            </div>

            <div className="form-group">
              <label>CUSTOM STATUS MOTD:</label>
              <input
                type="text"
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
