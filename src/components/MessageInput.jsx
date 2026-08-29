import React, { useState, useRef, useEffect } from 'react';
import { 
  Send, 
  Paperclip, 
  Mic, 
  Code, 
  FileCode, 
  MapPin, 
  Smile, 
  X, 
  FileText
} from 'lucide-react';
import { soundFX } from '../services/audioService';

const CYBER_EMOJIS = ['⚡', '🔥', '👾', '💀', '🛡️', '👁️', '💻', '🔒', '🚀', '⚠️', '🛰️', '📡', '💣', '🧪'];

const MessageInput = ({ onSendMessage, replyingTo, onCancelReply, activeContact }) => {
  const [text, setText] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [recordSeconds, setRecordSeconds] = useState(0);
  const [showAttachMenu, setShowAttachMenu] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showCodeModal, setShowCodeModal] = useState(false);
  const [codeContent, setCodeContent] = useState('');
  const [codeLanguage, setCodeLanguage] = useState('python');
  
  const recordTimerRef = useRef(null);
  const inputRef = useRef(null);

  // Voice recording simulation
  useEffect(() => {
    if (isRecording) {
      recordTimerRef.current = setInterval(() => {
        setRecordSeconds((prev) => prev + 1);
      }, 1000);
    } else {
      clearInterval(recordTimerRef.current);
    }
    return () => clearInterval(recordTimerRef.current);
  }, [isRecording]);

  const handleSend = (e) => {
    e?.preventDefault();
    if (!text.trim()) return;

    soundFX.playSent();
    onSendMessage({
      type: 'text',
      text: text.trim(),
      replyTo: replyingTo ? { sender: replyingTo.sender, text: replyingTo.text } : null,
    });

    setText('');
    onCancelReply();
    if (inputRef.current) inputRef.current.focus();
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    } else {
      soundFX.playKeypress();
    }
  };

  const startVoiceRecording = () => {
    soundFX.playKeypress();
    setRecordSeconds(0);
    setIsRecording(true);
  };

  const cancelVoiceRecording = () => {
    soundFX.playKeypress();
    setIsRecording(false);
    setRecordSeconds(0);
  };

  const sendVoiceRecording = () => {
    soundFX.playSent();
    const durationStr = `0:${recordSeconds < 10 ? '0' : ''}${recordSeconds || 7}`;
    const randomWave = Array.from({ length: 15 }, () => Math.floor(25 + Math.random() * 75));

    onSendMessage({
      type: 'audio',
      text: 'Encrypted voice intercept transmission',
      audioDuration: durationStr,
      audioWaveform: randomWave,
      replyTo: replyingTo ? { sender: replyingTo.sender, text: replyingTo.text } : null,
    });

    setIsRecording(false);
    setRecordSeconds(0);
    onCancelReply();
  };

  const sendCodePayload = () => {
    if (!codeContent.trim()) return;
    soundFX.playSent();

    onSendMessage({
      type: 'code',
      code: codeContent,
      language: codeLanguage,
      text: `Executable code snippet dispatched [${codeLanguage}]`,
      replyTo: replyingTo ? { sender: replyingTo.sender, text: replyingTo.text } : null,
    });

    setCodeContent('');
    setShowCodeModal(false);
    onCancelReply();
  };

  const sendSampleFile = () => {
    soundFX.playSent();
    onSendMessage({
      type: 'file',
      fileName: 'exploit_buffer_patch_v2.bin',
      fileSize: '12.4 MB',
      checksum: '8f9b4c02da18237c86e09c12289f664a78129846b0d9124a9e217830b05b4b1a',
      text: 'Attached secure encrypted data binary payload.',
      replyTo: replyingTo ? { sender: replyingTo.sender, text: replyingTo.text } : null,
    });
    setShowAttachMenu(false);
  };

  const sendLocationPin = () => {
    soundFX.playSent();
    onSendMessage({
      type: 'text',
      text: '📍 SATELLITE RADAR COORDS: Lat 37.7749° N, Lon 122.4194° W [ENCRYPTED GRID 0x4F]',
      replyTo: replyingTo ? { sender: replyingTo.sender, text: replyingTo.text } : null,
    });
    setShowAttachMenu(false);
  };

  return (
    <div className="message-composer-wrapper">
      {/* Reply banner */}
      {replyingTo && (
        <div className="composer-reply-banner">
          <div className="reply-content">
            <span className="reply-label">REPLYING TO:</span>
            <span className="reply-text">{replyingTo.text || 'Message payload'}</span>
          </div>
          <button className="reply-close-btn" onClick={onCancelReply}>
            <X size={14} />
          </button>
        </div>
      )}

      {/* Code builder modal */}
      {showCodeModal && (
        <div className="composer-code-modal">
          <div className="code-modal-header">
            <div className="modal-title">
              <FileCode size={16} />
              <span>TRANSMIT CODE PAYLOAD</span>
            </div>
            <button className="close-btn" onClick={() => setShowCodeModal(false)}>
              <X size={16} />
            </button>
          </div>

          <div className="code-modal-body">
            <div className="form-row">
              <label>LANGUAGE: </label>
              <select 
                value={codeLanguage} 
                onChange={(e) => setCodeLanguage(e.target.value)}
                className="cyber-select"
              >
                <option value="python">Python</option>
                <option value="javascript">JavaScript / TypeScript</option>
                <option value="bash">Bash / Shell</option>
                <option value="c">C / C++ / ASM</option>
                <option value="rust">Rust</option>
                <option value="json">JSON / Config</option>
              </select>
            </div>

            <textarea
              placeholder="// Paste your encrypted exploit or script here..."
              value={codeContent}
              onChange={(e) => setCodeContent(e.target.value)}
              className="code-textarea"
              rows={8}
            />
          </div>

          <div className="code-modal-footer">
            <button className="cyber-btn btn-secondary" onClick={() => setShowCodeModal(false)}>CANCEL</button>
            <button className="cyber-btn btn-primary" onClick={sendCodePayload}>TRANSMIT PAYLOAD</button>
          </div>
        </div>
      )}

      {/* Main Composer Bar */}
      {isRecording ? (
        <div className="voice-recording-hud">
          <div className="recording-indicator">
            <div className="red-blink"></div>
            <span>RECORDING INTERCEPT [ 0:{recordSeconds < 10 ? '0' : ''}{recordSeconds} ]</span>
          </div>

          <div className="recording-wave-preview">
            <div className="anim-wave-bar"></div>
            <div className="anim-wave-bar"></div>
            <div className="anim-wave-bar"></div>
            <div className="anim-wave-bar"></div>
            <div className="anim-wave-bar"></div>
          </div>

          <div className="recording-actions">
            <button className="btn-cancel-rec" onClick={cancelVoiceRecording} title="Discard Recording">
              <X size={18} />
            </button>
            <button className="btn-send-rec" onClick={sendVoiceRecording} title="Transmit Voice Intercept">
              <Send size={18} />
            </button>
          </div>
        </div>
      ) : (
        <div className="composer-bar">
          
          {/* Attachment Toggle */}
          <div className="attach-wrapper">
            <button 
              className={`composer-icon-btn ${showAttachMenu ? 'active' : ''}`}
              onClick={() => { soundFX.playKeypress(); setShowAttachMenu(!showAttachMenu); }}
              title="Attach Payload"
            >
              <Paperclip size={18} />
            </button>

            {showAttachMenu && (
              <div className="attachment-dropdown">
                <button onClick={() => { setShowCodeModal(true); setShowAttachMenu(false); }}>
                  <Code size={15} /> Code Snippet
                </button>
                <button onClick={sendSampleFile}>
                  <FileText size={15} /> Encrypted File Payload
                </button>
                <button onClick={sendLocationPin}>
                  <MapPin size={15} /> Radar Coordinates
                </button>
              </div>
            )}
          </div>

          {/* Emoji / Hacker Stickers */}
          <div className="emoji-wrapper">
            <button 
              className={`composer-icon-btn ${showEmojiPicker ? 'active' : ''}`}
              onClick={() => { soundFX.playKeypress(); setShowEmojiPicker(!showEmojiPicker); }}
              title="Cyber Reactions"
            >
              <Smile size={18} />
            </button>

            {showEmojiPicker && (
              <div className="emoji-popover">
                <div className="emoji-grid">
                  {CYBER_EMOJIS.map((e) => (
                    <button 
                      key={e} 
                      onClick={() => {
                        setText(prev => prev + ' ' + e);
                        setShowEmojiPicker(false);
                        inputRef.current?.focus();
                      }}
                      className="emoji-grid-btn"
                    >
                      {e}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Text Input */}
          <form className="composer-form" onSubmit={handleSend}>
            <input 
              ref={inputRef}
              type="text" 
              placeholder={`Transmit encrypted signal to ${activeContact?.name || 'node'}... (Type / for commands)`}
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={handleKeyDown}
              className="composer-input"
            />
          </form>

          {/* Send or Voice Record Trigger */}
          {text.trim() ? (
            <button className="composer-send-btn" onClick={handleSend} title="Send Message (Enter)">
              <Send size={18} />
            </button>
          ) : (
            <button className="composer-mic-btn" onClick={startVoiceRecording} title="Record Voice Intercept">
              <Mic size={18} />
            </button>
          )}

        </div>
      )}
    </div>
  );
};

export default MessageInput;
