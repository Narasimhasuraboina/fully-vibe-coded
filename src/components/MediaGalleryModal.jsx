import React, { useState } from 'react';
import { 
  X, 
  Image as ImageIcon, 
  Video, 
  Mic, 
  FileText, 
  Code, 
  Search, 
  ExternalLink,
  Shield 
} from 'lucide-react';
import { soundFX } from '../services/audioService';

const MediaGalleryModal = ({ contact, messages = [], onClose, onOpenMedia }) => {
  const [activeTab, setActiveTab] = useState('all'); // 'all' | 'images' | 'videos' | 'audio' | 'docs' | 'code'
  const [searchQuery, setSearchQuery] = useState('');

  // Extract all media items from messages
  const allMediaItems = messages.filter((m) => 
    ['image', 'video', 'audio', 'file', 'code'].includes(m.type) || (m.mediaUrl && m.type !== 'text')
  );

  const filteredItems = allMediaItems.filter((item) => {
    // Tab filter
    if (activeTab === 'images' && item.type !== 'image') return false;
    if (activeTab === 'videos' && item.type !== 'video') return false;
    if (activeTab === 'audio' && item.type !== 'audio') return false;
    if (activeTab === 'docs' && item.type !== 'file') return false;
    if (activeTab === 'code' && item.type !== 'code') return false;

    // Search query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchText = (item.text || '').toLowerCase().includes(q);
      const matchName = (item.fileName || '').toLowerCase().includes(q);
      const matchCode = (item.code || '').toLowerCase().includes(q);
      return matchText || matchName || matchCode;
    }
    return true;
  });

  return (
    <div className="cyber-modal-backdrop" onClick={onClose}>
      <div className="cyber-modal media-vault-modal" onClick={(e) => e.stopPropagation()}>
        
        {/* Header */}
        <div className="cyber-modal-header">
          <div className="modal-title">
            <Shield size={18} className="text-accent" />
            <span>SESSION VAULT // {contact?.name || 'NODE'}</span>
          </div>
          <button className="cyber-modal-close" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        {/* Top Controls: Search & Tabs */}
        <div className="vault-nav-section">
          <div className="vault-search-box">
            <Search size={14} className="text-muted" />
            <input
              type="text"
              placeholder="Search payloads in vault..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            {searchQuery && (
              <button className="clear-search" onClick={() => setSearchQuery('')}>
                <X size={12} />
              </button>
            )}
          </div>

          <div className="vault-tabs">
            <button 
              className={`vault-tab-btn ${activeTab === 'all' ? 'active' : ''}`}
              onClick={() => { soundFX.playKeypress(); setActiveTab('all'); }}
            >
              ALL ({allMediaItems.length})
            </button>
            <button 
              className={`vault-tab-btn ${activeTab === 'images' ? 'active' : ''}`}
              onClick={() => { soundFX.playKeypress(); setActiveTab('images'); }}
            >
              <ImageIcon size={13} /> IMAGES ({allMediaItems.filter(m => m.type === 'image').length})
            </button>
            <button 
              className={`vault-tab-btn ${activeTab === 'videos' ? 'active' : ''}`}
              onClick={() => { soundFX.playKeypress(); setActiveTab('videos'); }}
            >
              <Video size={13} /> VIDEOS ({allMediaItems.filter(m => m.type === 'video').length})
            </button>
            <button 
              className={`vault-tab-btn ${activeTab === 'audio' ? 'active' : ''}`}
              onClick={() => { soundFX.playKeypress(); setActiveTab('audio'); }}
            >
              <Mic size={13} /> AUDIO ({allMediaItems.filter(m => m.type === 'audio').length})
            </button>
            <button 
              className={`vault-tab-btn ${activeTab === 'docs' ? 'active' : ''}`}
              onClick={() => { soundFX.playKeypress(); setActiveTab('docs'); }}
            >
              <FileText size={13} /> DOCS ({allMediaItems.filter(m => m.type === 'file').length})
            </button>
            <button 
              className={`vault-tab-btn ${activeTab === 'code' ? 'active' : ''}`}
              onClick={() => { soundFX.playKeypress(); setActiveTab('code'); }}
            >
              <Code size={13} /> CODE ({allMediaItems.filter(m => m.type === 'code').length})
            </button>
          </div>
        </div>

        {/* Vault Content Grid */}
        <div className="vault-content-area">
          {filteredItems.length === 0 ? (
            <div className="vault-empty">
              <Shield size={36} className="text-muted opacity-40" />
              <p>No encrypted media or payloads found in this session partition.</p>
            </div>
          ) : (
            <div className="vault-grid">
              {filteredItems.map((item) => (
                <div 
                  key={item.id} 
                  className={`vault-card vault-card-${item.type}`}
                  onClick={() => {
                    if (['image', 'video'].includes(item.type)) {
                      onOpenMedia(item);
                    }
                  }}
                >
                  {item.type === 'image' ? (
                    <div className="vault-image-preview">
                      <img src={item.mediaUrl} alt={item.fileName || 'Payload'} />
                      <div className="vault-overlay-hover">
                        <ExternalLink size={16} />
                      </div>
                    </div>
                  ) : item.type === 'video' ? (
                    <div className="vault-video-preview">
                      <video src={item.mediaUrl} preload="metadata" />
                      <div className="video-play-tag">
                        <Video size={14} />
                      </div>
                    </div>
                  ) : item.type === 'audio' ? (
                    <div className="vault-doc-preview audio-box">
                      <Mic size={24} className="text-accent" />
                      <div className="doc-meta">
                        <span className="doc-name">Voice Intercept</span>
                        <span className="doc-size">{item.audioDuration || '0:15'}</span>
                      </div>
                    </div>
                  ) : item.type === 'code' ? (
                    <div className="vault-doc-preview code-box">
                      <Code size={24} className="text-warning" />
                      <div className="doc-meta">
                        <span className="doc-name">{item.language?.toUpperCase() || 'CODE'} Snippet</span>
                        <span className="doc-size">{item.code?.length || 0} chars</span>
                      </div>
                    </div>
                  ) : (
                    <div className="vault-doc-preview">
                      <FileText size={24} className="text-accent" />
                      <div className="doc-meta">
                        <span className="doc-name">{item.fileName || 'binary.bin'}</span>
                        <span className="doc-size">{item.fileSize || 'RAW PAYLOAD'}</span>
                      </div>
                    </div>
                  )}

                  <div className="vault-card-footer">
                    <span className="vault-timestamp">{item.timestamp}</span>
                    <span className="vault-sender">{item.sender === 'user' ? 'YOU' : contact?.name}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

      </div>
    </div>
  );
};

export default MediaGalleryModal;
