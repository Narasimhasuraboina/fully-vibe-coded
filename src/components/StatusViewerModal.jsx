import React, { useState, useEffect } from 'react';
import { 
  X, 
  Download, 
  ChevronLeft, 
  ChevronRight, 
  Check, 
  ShieldAlert,
  Send
} from 'lucide-react';
import { soundFX } from '../services/audioService';

const StatusViewerModal = ({ stories, initialStoryId, onClose, onReplyToStatus, gbSettings }) => {
  const [currentIndex, setCurrentIndex] = useState(() => {
    const idx = stories.findIndex((s) => s.id === initialStoryId);
    return idx !== -1 ? idx : 0;
  });
  const [progress, setProgress] = useState(0);
  const [replyText, setReplyText] = useState('');
  const [downloaded, setDownloaded] = useState(false);

  const currentStory = stories[currentIndex] || stories[0];

  useEffect(() => {
    const interval = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 100) {
          if (currentIndex < stories.length - 1) {
            setCurrentIndex((i) => i + 1);
            return 0;
          } else {
            clearInterval(interval);
            onClose();
            return 100;
          }
        }
        return prev + 2;
      });
    }, 100);

    return () => clearInterval(interval);
  }, [currentIndex, stories.length, onClose]);

  const handleNext = () => {
    if (currentIndex < stories.length - 1) {
      soundFX.playKeypress();
      setCurrentIndex(currentIndex + 1);
      setProgress(0);
    } else {
      onClose();
    }
  };

  const handlePrev = () => {
    if (currentIndex > 0) {
      soundFX.playKeypress();
      setCurrentIndex(currentIndex - 1);
      setProgress(0);
    }
  };

  const handleDownloadStatus = () => {
    soundFX.playKeypress();
    setDownloaded(true);
    setTimeout(() => setDownloaded(false), 2000);
  };

  const handleSendReply = (e) => {
    e.preventDefault();
    if (!replyText.trim()) return;
    soundFX.playSent();
    onReplyToStatus(currentStory.contactId, `Replying to status "${currentStory.caption || currentStory.text}": ${replyText.trim()}`);
    setReplyText('');
    onClose();
  };

  if (!currentStory) return null;

  return (
    <div className="status-modal-overlay">
      <div className="status-container">
        
        {/* Progress Bars */}
        <div className="status-progress-bars">
          {stories.map((s, idx) => (
            <div key={s.id} className="progress-bar-track">
              <div 
                className="progress-bar-fill"
                style={{
                  width: idx === currentIndex ? `${progress}%` : idx < currentIndex ? '100%' : '0%'
                }}
              />
            </div>
          ))}
        </div>

        {/* Story Header */}
        <div className="status-header">
          <div className="status-user-info">
            <img src={currentStory.avatar} alt={currentStory.contactName} className="status-avatar" />
            <div className="status-text-meta">
              <span className="status-author">{currentStory.contactName}</span>
              <span className="status-time">{currentStory.timestamp}</span>
            </div>
            
            {/* Anti-Revoke Status Badge (GB Feature) */}
            {currentStory.isAntiRevoke && gbSettings.antiDeleteStatus && (
              <span className="anti-revoke-pill">
                <ShieldAlert size={12} /> REVOKED (GB RECOVERED)
              </span>
            )}
          </div>

          <div className="status-header-actions">
            {/* Download Status Media Button (GB Feature) */}
            <button 
              className="status-icon-btn" 
              onClick={handleDownloadStatus}
              title="Download & Save Status Media (GB Feature)"
            >
              {downloaded ? <Check size={18} className="text-accent" /> : <Download size={18} />}
            </button>

            <button className="status-icon-btn" onClick={onClose} title="Close">
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Story Body Stage */}
        <div className="status-body-stage">
          <button className="nav-arrow left" onClick={handlePrev}><ChevronLeft size={24} /></button>

          {currentStory.mediaType === 'image' ? (
            <div className="status-image-view">
              <img src={currentStory.mediaUrl} alt="Status Media" className="status-img" />
              {currentStory.caption && (
                <div className="status-caption-overlay">
                  <p>{currentStory.caption}</p>
                </div>
              )}
            </div>
          ) : (
            <div className="status-text-view" style={{ background: currentStory.bgStyle || '#050a05' }}>
              <p className="status-quote">{currentStory.text}</p>
            </div>
          )}

          <button className="nav-arrow right" onClick={handleNext}><ChevronRight size={24} /></button>
        </div>

        {/* Reply to Status */}
        <form onSubmit={handleSendReply} className="status-reply-bar">
          <input 
            type="text" 
            placeholder={`Reply to ${currentStory.contactName}...`}
            value={replyText}
            onChange={(e) => setReplyText(e.target.value)}
          />
          <button type="submit" className="status-send-btn">
            <Send size={16} />
          </button>
        </form>

      </div>
    </div>
  );
};

export default StatusViewerModal;
