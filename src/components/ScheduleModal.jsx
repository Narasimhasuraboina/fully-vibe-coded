import React, { useState } from 'react';
import { Calendar, X, Clock } from 'lucide-react';
import { soundFX } from '../services/audioService';

const ScheduleModal = ({ contacts, activeContact, onClose, onScheduleMessage }) => {
  const [selectedContactId, setSelectedContactId] = useState(activeContact?.id || contacts[0]?.id || '');
  const [timeStr, setTimeStr] = useState('23:59');
  const [message, setMessage] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!message.trim()) return;

    soundFX.playKeypress();
    const contact = contacts.find(c => c.id === selectedContactId) || contacts[0];
    onScheduleMessage({
      id: `sch_${Date.now()}`,
      contactId: contact.id,
      contactName: contact.name,
      message: message.trim(),
      scheduledTime: timeStr,
      status: 'pending',
    });
    onClose();
  };

  return (
    <div className="modal-backdrop">
      <div className="cyber-modal">
        <div className="modal-header">
          <div className="modal-title">
            <Calendar size={16} className="text-accent" />
            <span>SCHEDULE MESSAGE TRANSMISSION</span>
          </div>
          <button className="btn-close" onClick={onClose}><X size={16} /></button>
        </div>

        <div className="modal-body">
          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label>SELECT TARGET NODE:</label>
              <select 
                value={selectedContactId} 
                onChange={(e) => setSelectedContactId(e.target.value)}
                className="cyber-select"
              >
                {contacts.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} ({c.tag})
                  </option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label>DISPATCH TIME (UTC):</label>
              <input 
                type="time" 
                value={timeStr}
                onChange={(e) => setTimeStr(e.target.value)}
                className="cyber-input"
                required
              />
            </div>

            <div className="form-group">
              <label>MESSAGE PAYLOAD:</label>
              <textarea 
                placeholder="Type payload to dispatch automatically at scheduled time..."
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                rows={3}
                required
                className="cyber-textarea"
              />
            </div>

            <div className="modal-footer-actions">
              <button type="button" className="cyber-btn btn-secondary" onClick={onClose}>
                CANCEL
              </button>
              <button type="submit" className="cyber-btn btn-primary">
                <Clock size={14} /> QUEUE TRANSMISSION
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default ScheduleModal;
