import React, { useState } from 'react';
import { Send, X, Radio } from 'lucide-react';
import { soundFX } from '../services/audioService';

const DirectChatModal = ({ onClose, onStartDirectChat }) => {
  const [targetNumberOrIp, setTargetNumberOrIp] = useState('');
  const [initialMessage, setInitialMessage] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!targetNumberOrIp.trim()) return;

    soundFX.playSent();
    onStartDirectChat(targetNumberOrIp.trim(), initialMessage.trim());
    onClose();
  };

  return (
    <div className="modal-backdrop">
      <div className="cyber-modal">
        <div className="modal-header">
          <div className="modal-title">
            <Radio size={16} className="text-accent" />
            <span>DIRECT CHAT (UNSAVED NUMBER / IP)</span>
          </div>
          <button className="btn-close" onClick={onClose}><X size={16} /></button>
        </div>

        <div className="modal-body">
          <p className="modal-description">
            GB-Mod direct packet routing allows establishing an encrypted channel without adding the target to your contact address book.
          </p>

          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label>TARGET PHONE NUMBER / NODE IP ADDRESS:</label>
              <input 
                type="text" 
                placeholder="+1 (555) 019-2834 or 192.168.1.100" 
                value={targetNumberOrIp}
                onChange={(e) => setTargetNumberOrIp(e.target.value)}
                autoFocus
                required
                className="cyber-input"
              />
            </div>

            <div className="form-group">
              <label>INITIAL MESSAGE PAYLOAD (OPTIONAL):</label>
              <textarea 
                placeholder="Handshake payload or message..."
                value={initialMessage}
                onChange={(e) => setInitialMessage(e.target.value)}
                rows={3}
                className="cyber-textarea"
              />
            </div>

            <div className="modal-footer-actions">
              <button type="button" className="cyber-btn btn-secondary" onClick={onClose}>
                CANCEL
              </button>
              <button type="submit" className="cyber-btn btn-primary">
                <Send size={14} /> OPEN DIRECT CHANNEL
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default DirectChatModal;
