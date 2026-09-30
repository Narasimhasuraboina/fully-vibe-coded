import React, { useState, useEffect } from 'react';
import { Calendar, X, Clock, Users } from 'lucide-react';
import { soundFX } from '../services/audioService';

const ScheduleModal = ({ contacts = [], activeContact, onClose, onScheduleMessage }) => {
  const [selectedContactId, setSelectedContactId] = useState(
    activeContact?.id || contacts[0]?.id || ''
  );

  const getDefaultTime = () => {
    const d = new Date(Date.now() + 5 * 60000);
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  };

  const [timeStr, setTimeStr] = useState(getDefaultTime);
  const [message, setMessage] = useState('');

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!message.trim()) return;

    const contact = contacts.find((c) => c.id === selectedContactId) || contacts[0];
    if (!contact) return;

    soundFX.playKeypress();
    onScheduleMessage({
      id: `sch_${Date.now()}`,
      contactId: contact.id,
      contactName: contact.name || contact.tag,
      message: message.trim(),
      scheduledTime: timeStr,
      status: 'pending',
    });
    onClose();
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div 
        className="cyber-modal" 
        role="dialog" 
        aria-modal="true" 
        aria-labelledby="schedule-modal-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-header">
          <div className="modal-title" id="schedule-modal-title">
            <Calendar size={16} className="text-accent" />
            <span>SCHEDULE MESSAGE TRANSMISSION</span>
          </div>
          <button type="button" className="btn-close" onClick={onClose} aria-label="Close scheduling modal">
            <X size={16} />
          </button>
        </div>

        <div className="modal-body">
          {contacts.length === 0 ? (
            <div className="text-center py-6 text-muted text-xs">
              <Users size={32} className="mx-auto text-accent opacity-50 mb-2" />
              <p className="font-semibold text-text-main">No target nodes available</p>
              <p className="mt-1">Add or search for contacts first to queue scheduled transmissions.</p>
              <div className="mt-4">
                <button type="button" className="cyber-btn btn-secondary" onClick={onClose}>
                  CLOSE
                </button>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label htmlFor="schedule-target-select">SELECT TARGET NODE:</label>
                <select 
                  id="schedule-target-select"
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
                <label htmlFor="schedule-dispatch-time">DISPATCH TIME (LOCAL / 24H):</label>
                <input 
                  id="schedule-dispatch-time"
                  type="time" 
                  value={timeStr}
                  onChange={(e) => setTimeStr(e.target.value)}
                  className="cyber-input"
                  required
                />
              </div>

              <div className="form-group">
                <label htmlFor="schedule-message-payload">MESSAGE PAYLOAD:</label>
                <textarea 
                  id="schedule-message-payload"
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
                <button type="submit" className="cyber-btn btn-primary" disabled={!message.trim() || !selectedContactId}>
                  <Clock size={14} /> QUEUE TRANSMISSION
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};

export default ScheduleModal;
