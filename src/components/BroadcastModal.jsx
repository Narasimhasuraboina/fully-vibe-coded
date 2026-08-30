import React, { useState } from 'react';
import { Radio, X, CheckSquare, Square, Zap } from 'lucide-react';
import { soundFX } from '../services/audioService';

const BroadcastModal = ({ contacts, onClose, onBroadcastMessage }) => {
  const [selectedIds, setSelectedIds] = useState(contacts.map(c => c.id));
  const [broadcastText, setBroadcastText] = useState('');

  const toggleSelectAll = () => {
    soundFX.playKeypress();
    if (selectedIds.length === contacts.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(contacts.map(c => c.id));
    }
  };

  const toggleContact = (id) => {
    soundFX.playKeypress();
    setSelectedIds(prev => 
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const handleSend = (e) => {
    e.preventDefault();
    if (!broadcastText.trim() || selectedIds.length === 0) return;

    soundFX.playSent();
    onBroadcastMessage(broadcastText.trim(), selectedIds);
    onClose();
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="cyber-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title">
            <Radio size={16} className="text-accent" />
            <span>MASS BROADCAST BLASTER</span>
          </div>
          <button className="btn-close" onClick={onClose}><X size={16} /></button>
        </div>

        <div className="modal-body">
          <div className="broadcast-stats">
            <span className="count-label">RECIPIENTS: {selectedIds.length} / {contacts.length} NODES</span>
            <button type="button" className="btn-toggle-all" onClick={toggleSelectAll}>
              {selectedIds.length === contacts.length ? 'DESELECT ALL' : 'SELECT ALL'}
            </button>
          </div>

          <div className="broadcast-contact-grid">
            {contacts.map((c) => {
              const isChecked = selectedIds.includes(c.id);
              return (
                <div 
                  key={c.id} 
                  className={`contact-check-card ${isChecked ? 'checked' : ''}`}
                  onClick={() => toggleContact(c.id)}
                >
                  {isChecked ? <CheckSquare size={15} className="text-accent" /> : <Square size={15} />}
                  <img src={c.avatar} alt={c.name} className="mini-avatar" />
                  <span className="c-name">{c.name}</span>
                </div>
              );
            })}
          </div>

          <form onSubmit={handleSend}>
            <div className="form-group">
              <label>BROADCAST PAYLOAD:</label>
              <textarea 
                placeholder="Type transmission to broadcast to all selected nodes..."
                value={broadcastText}
                onChange={(e) => setBroadcastText(e.target.value)}
                rows={3}
                required
                className="cyber-textarea"
              />
            </div>

            <div className="modal-footer-actions">
              <button type="button" className="cyber-btn btn-secondary" onClick={onClose}>
                CANCEL
              </button>
              <button type="submit" className="cyber-btn btn-primary" disabled={selectedIds.length === 0}>
                <Zap size={14} /> TRANSMIT BROADCAST
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default BroadcastModal;
