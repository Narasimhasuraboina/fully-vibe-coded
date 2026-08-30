import React, { useState } from 'react';
import { 
  X, 
  Send, 
  Search, 
  CornerUpRight, 
  Check, 
  Radio 
} from 'lucide-react';
import { soundFX } from '../services/audioService';

const ForwardModal = ({ message, contacts = [], onClose, onForwardMessage }) => {
  const [selectedContacts, setSelectedContacts] = useState([]);
  const [search, setSearch] = useState('');
  const [customTag, setCustomTag] = useState('');

  const filteredContacts = contacts.filter((c) =>
    (c.name || '').toLowerCase().includes(search.toLowerCase()) ||
    (c.tag || '').toLowerCase().includes(search.toLowerCase())
  );

  const toggleSelect = (id) => {
    soundFX.playKeypress();
    setSelectedContacts((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const handleSendForward = () => {
    soundFX.playSent();
    selectedContacts.forEach((contactId) => {
      onForwardMessage(message, contactId);
    });

    if (customTag.trim()) {
      onForwardMessage(message, customTag.trim());
    }

    onClose();
  };

  return (
    <div className="cyber-modal-backdrop" onClick={onClose}>
      <div className="cyber-modal forward-modal" onClick={(e) => e.stopPropagation()}>
        
        {/* Header */}
        <div className="cyber-modal-header">
          <div className="modal-title">
            <CornerUpRight size={18} className="text-accent" />
            <span>FORWARD ENCRYPTED PAYLOAD</span>
          </div>
          <button className="cyber-modal-close" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        <div className="forward-body">
          {/* Message Preview */}
          <div className="forward-preview-box">
            <span className="preview-label">PAYLOAD SUMMARY:</span>
            <p className="preview-text">
              {message.type === 'image'
                ? '📷 [Encrypted Image Payload]'
                : message.type === 'video'
                ? '🎥 [Encrypted Video Stream]'
                : message.type === 'audio'
                ? '🎙️ [Encrypted Voice Intercept]'
                : message.type === 'code'
                ? `💻 [Code: ${message.language || 'Snippet'}]`
                : message.text || 'Encrypted Binary'}
            </p>
          </div>

          {/* Search bar */}
          <div className="forward-search-box">
            <Search size={14} className="text-muted" />
            <input
              type="text"
              placeholder="Search destination nodes..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          {/* Contact Select List */}
          <div className="forward-list">
            {filteredContacts.length === 0 ? (
              <div className="no-contacts">
                <Radio size={20} className="text-muted" />
                <span>No matching peer nodes found</span>
              </div>
            ) : (
              filteredContacts.map((c) => {
                const isSelected = selectedContacts.includes(c.id);
                return (
                  <div
                    key={c.id}
                    className={`forward-contact-item ${isSelected ? 'selected' : ''}`}
                    onClick={() => toggleSelect(c.id)}
                  >
                    <img src={c.avatar} alt={c.name} className="contact-avatar" />
                    <div className="contact-info">
                      <span className="contact-name">{c.name}</span>
                      <span className="contact-tag">{c.tag}</span>
                    </div>
                    <div className={`select-check ${isSelected ? 'checked' : ''}`}>
                      {isSelected && <Check size={14} />}
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Custom Username Input */}
          <div className="custom-destination-box">
            <label>OR FORWARD DIRECTLY TO CODENAME (@USERNAME):</label>
            <input
              type="text"
              placeholder="@target_operator"
              value={customTag}
              onChange={(e) => setCustomTag(e.target.value)}
              className="cyber-input"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="cyber-modal-footer">
          <button className="cyber-btn btn-secondary" onClick={onClose}>
            CANCEL
          </button>
          <button 
            className="cyber-btn btn-primary" 
            onClick={handleSendForward}
            disabled={selectedContacts.length === 0 && !customTag.trim()}
          >
            <Send size={14} /> FORWARD ({selectedContacts.length + (customTag.trim() ? 1 : 0)})
          </button>
        </div>

      </div>
    </div>
  );
};

export default ForwardModal;
