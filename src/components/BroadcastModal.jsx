import React, { useState, useEffect } from 'react';
import { Radio, X, CheckSquare, Square, Zap, Users } from 'lucide-react';
import { soundFX } from '../services/audioService';

const BroadcastModal = ({ contacts = [], onClose, onBroadcastMessage }) => {
  const [selectedIds, setSelectedIds] = useState(() => (contacts || []).map(c => c.id));
  const [broadcastText, setBroadcastText] = useState('');

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

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
      <div 
        className="cyber-modal" 
        role="dialog" 
        aria-modal="true" 
        aria-labelledby="broadcast-modal-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-header">
          <div className="modal-title" id="broadcast-modal-title">
            <Radio size={16} className="text-accent" />
            <span>MASS BROADCAST BLASTER</span>
          </div>
          <button type="button" className="btn-close" onClick={onClose} aria-label="Close broadcast modal">
            <X size={16} />
          </button>
        </div>

        <div className="modal-body">
          {contacts.length === 0 ? (
            <div className="text-center py-6 text-muted text-xs">
              <Users size={32} className="mx-auto text-accent opacity-50 mb-2" />
              <p className="font-semibold text-text-main">No destination nodes available</p>
              <p className="mt-1">Add or search for contacts first to broadcast payloads.</p>
              <div className="mt-4">
                <button type="button" className="cyber-btn btn-secondary" onClick={onClose}>
                  CLOSE
                </button>
              </div>
            </div>
          ) : (
            <>
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
                      role="checkbox"
                      aria-checked={isChecked}
                      tabIndex={0}
                      onKeyDown={(e) => {
                        if (e.key === ' ' || e.key === 'Enter') {
                          e.preventDefault();
                          toggleContact(c.id);
                        }
                      }}
                    >
                      {isChecked ? <CheckSquare size={15} className="text-accent" /> : <Square size={15} />}
                      <img src={c.avatar || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&auto=format&fit=crop&q=80'} alt="" className="mini-avatar" />
                      <span className="c-name">{c.name}</span>
                    </div>
                  );
                })}
              </div>

              <form onSubmit={handleSend}>
                <div className="form-group">
                  <label htmlFor="broadcast-payload">BROADCAST PAYLOAD:</label>
                  <textarea 
                    id="broadcast-payload"
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
                  <button type="submit" className="cyber-btn btn-primary" disabled={selectedIds.length === 0 || !broadcastText.trim()}>
                    <Zap size={14} /> TRANSMIT BROADCAST
                  </button>
                </div>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default BroadcastModal;
