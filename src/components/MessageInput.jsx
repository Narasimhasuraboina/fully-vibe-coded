import React, { useState, useRef, useEffect, useCallback } from 'react';
import { 
  Send, 
  Paperclip, 
  Mic, 
  Code, 
  FileCode, 
  MapPin, 
  Smile, 
  X, 
  FileText, 
  Image as ImageIcon, 
  Video, 
  Camera, 
  Flame 
} from 'lucide-react';
import { soundFX } from '../services/audioService';
import { socketService } from '../services/socketService';

const CYBER_EMOJIS = ['⚡', '🔥', '👾', '💀', '🛡️', '👁️', '💻', '🔒', '🚀', '⚠️', '🛰️', '📡', '💣', '🧪', '✨', '🎯'];

const MessageInput = ({ onSendMessage, replyingTo, onCancelReply, activeContact }) => {
  const [text, setText] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [recordSeconds, setRecordSeconds] = useState(0);
  const [showAttachMenu, setShowAttachMenu] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showCodeModal, setShowCodeModal] = useState(false);
  const [codeContent, setCodeContent] = useState('');
  const [codeLanguage, setCodeLanguage] = useState('javascript');
  
  // Media Preview State
  const [mediaPreview, setMediaPreview] = useState(null); // { type: 'image' | 'video', url, file, fileName, fileSize, caption, burnAfterRead }
  const [isDragging, setIsDragging] = useState(false);

  const fileInputRef = useRef(null);
  const videoInputRef = useRef(null);
  const docInputRef = useRef(null);
  const cameraInputRef = useRef(null);
  const inputRef = useRef(null);
  
  // Voice Recording Refs
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const recordTimerRef = useRef(null);
  const typingTimeoutRef = useRef(null);

  // Clean up typing on unmount
  useEffect(() => {
    return () => {
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      if (recordTimerRef.current) clearInterval(recordTimerRef.current);
    };
  }, []);

  // Handle typing indicator dispatch
  const handleInputChange = (e) => {
    setText(e.target.value);
    
    if (activeContact?.tag) {
      socketService.emitTyping(activeContact.tag, true);
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = setTimeout(() => {
        socketService.emitTyping(activeContact.tag, false);
      }, 1800);
    }
  };

  // Convert File to Base64 Data URL
  const fileToDataUrl = (file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  // Process chosen file for preview
  const handleProcessFile = useCallback(async (file) => {
    if (!file) return;
    soundFX.playKeypress();

    const isImg = file.type.startsWith('image/');
    const isVid = file.type.startsWith('video/');

    try {
      const dataUrl = await fileToDataUrl(file);
      const sizeMB = (file.size / (1024 * 1024)).toFixed(2);
      const sizeStr = file.size > 1024 * 1024 ? `${sizeMB} MB` : `${Math.round(file.size / 1024)} KB`;

      if (isImg || isVid) {
        setMediaPreview({
          type: isVid ? 'video' : 'image',
          url: dataUrl,
          file,
          fileName: file.name,
          fileSize: sizeStr,
          caption: '',
          burnAfterRead: false,
        });
      } else {
        // Generic document / payload
        soundFX.playSent();
        onSendMessage({
          type: 'file',
          fileName: file.name,
          fileSize: sizeStr,
          mediaUrl: dataUrl,
          checksum: `sha256_${Math.random().toString(36).substring(2, 10)}${Math.random().toString(36).substring(2, 10)}`,
          text: `Attached file payload: ${file.name}`,
          replyTo: replyingTo ? { sender: replyingTo.sender, text: replyingTo.text } : null,
        });
      }
    } catch (err) {
      console.error('[ATTACH] Error reading file:', err);
    }
    setShowAttachMenu(false);
  }, [onSendMessage, replyingTo]);

  // Clipboard Paste Detection (e.g. Ctrl+V with image screenshot)
  useEffect(() => {
    const handlePaste = async (e) => {
      const items = e.clipboardData?.items;
      if (!items) return;

      for (let i = 0; i < items.length; i++) {
        if (items[i].type.indexOf('image') !== -1) {
          const blob = items[i].getAsFile();
          if (blob) {
            e.preventDefault();
            handleProcessFile(blob);
            break;
          }
        }
      }
    };

    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
  }, [handleProcessFile]);

  // Send Text Message
  const handleSend = (e) => {
    e?.preventDefault();
    if (!text.trim()) return;

    soundFX.playSent();
    if (activeContact?.tag) {
      socketService.emitTyping(activeContact.tag, false);
    }

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

  // Send Media from Preview
  const handleSendMediaPreview = () => {
    if (!mediaPreview) return;
    soundFX.playSent();

    onSendMessage({
      type: mediaPreview.type,
      mediaUrl: mediaPreview.url,
      fileName: mediaPreview.fileName,
      fileSize: mediaPreview.fileSize,
      text: mediaPreview.caption || (mediaPreview.type === 'image' ? 'Encrypted image payload' : 'Encrypted video stream'),
      burnAfterRead: mediaPreview.burnAfterRead,
      burnCountdown: mediaPreview.burnAfterRead ? 5 : null,
      replyTo: replyingTo ? { sender: replyingTo.sender, text: replyingTo.text } : null,
    });

    setMediaPreview(null);
    onCancelReply();
  };

  // Voice Recording with real MediaRecorder API
  const startVoiceRecording = async () => {
    soundFX.playKeypress();
    audioChunksRef.current = [];
    setRecordSeconds(0);

    try {
      if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        const mediaRecorder = new MediaRecorder(stream);
        mediaRecorderRef.current = mediaRecorder;

        mediaRecorder.ondataavailable = (event) => {
          if (event.data && event.data.size > 0) {
            audioChunksRef.current.push(event.data);
          }
        };

        mediaRecorder.onstop = () => {
          stream.getTracks().forEach((t) => t.stop());
        };

        mediaRecorder.start();
        setIsRecording(true);

        recordTimerRef.current = setInterval(() => {
          setRecordSeconds((prev) => prev + 1);
        }, 1000);
      } else {
        // Fallback simulation
        setIsRecording(true);
        recordTimerRef.current = setInterval(() => {
          setRecordSeconds((prev) => prev + 1);
        }, 1000);
      }
    } catch (err) {
      console.warn('[VOICE] Mic access fallback:', err);
      setIsRecording(true);
      recordTimerRef.current = setInterval(() => {
        setRecordSeconds((prev) => prev + 1);
      }, 1000);
    }
  };

  const cancelVoiceRecording = () => {
    soundFX.playKeypress();
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    clearInterval(recordTimerRef.current);
    setIsRecording(false);
    setRecordSeconds(0);
    audioChunksRef.current = [];
  };

  const sendVoiceRecording = () => {
    soundFX.playSent();
    const durationStr = `0:${recordSeconds < 10 ? '0' : ''}${recordSeconds || 5}`;
    const randomWave = Array.from({ length: 18 }, () => Math.floor(25 + Math.random() * 75));

    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        const reader = new FileReader();
        reader.onloadend = () => {
          onSendMessage({
            type: 'audio',
            text: 'Encrypted voice intercept transmission',
            mediaUrl: reader.result,
            audioDuration: durationStr,
            audioWaveform: randomWave,
            replyTo: replyingTo ? { sender: replyingTo.sender, text: replyingTo.text } : null,
          });
        };
        reader.readAsDataURL(audioBlob);
      };
      mediaRecorderRef.current.stop();
    } else {
      onSendMessage({
        type: 'audio',
        text: 'Encrypted voice intercept transmission',
        audioDuration: durationStr,
        audioWaveform: randomWave,
        replyTo: replyingTo ? { sender: replyingTo.sender, text: replyingTo.text } : null,
      });
    }

    clearInterval(recordTimerRef.current);
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
      text: `Executable code payload [${codeLanguage}]`,
      replyTo: replyingTo ? { sender: replyingTo.sender, text: replyingTo.text } : null,
    });

    setCodeContent('');
    setShowCodeModal(false);
    onCancelReply();
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

  // Drag and drop handlers
  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer?.files && e.dataTransfer.files[0]) {
      handleProcessFile(e.dataTransfer.files[0]);
    }
  };

  return (
    <div 
      className={`message-composer-wrapper ${isDragging ? 'composer-dragging' : ''}`}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {/* Hidden File Inputs */}
      <input
        type="file"
        ref={fileInputRef}
        accept="image/*"
        style={{ display: 'none' }}
        onChange={(e) => handleProcessFile(e.target.files?.[0])}
      />
      <input
        type="file"
        ref={videoInputRef}
        accept="video/*"
        style={{ display: 'none' }}
        onChange={(e) => handleProcessFile(e.target.files?.[0])}
      />
      <input
        type="file"
        ref={docInputRef}
        accept="*/*"
        style={{ display: 'none' }}
        onChange={(e) => handleProcessFile(e.target.files?.[0])}
      />
      <input
        type="file"
        ref={cameraInputRef}
        accept="image/*"
        capture="environment"
        style={{ display: 'none' }}
        onChange={(e) => handleProcessFile(e.target.files?.[0])}
      />

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

      {/* Media Preview Modal Before Sending */}
      {mediaPreview && (
        <div className="media-preview-dialog">
          <div className="preview-header">
            <div className="preview-title">
              {mediaPreview.type === 'image' ? <ImageIcon size={16} /> : <Video size={16} />}
              <span>PREVIEW {mediaPreview.type.toUpperCase()} TRANSMISSION</span>
            </div>
            <button className="preview-close-btn" onClick={() => setMediaPreview(null)}>
              <X size={16} />
            </button>
          </div>

          <div className="preview-media-container">
            {mediaPreview.type === 'image' ? (
              <img src={mediaPreview.url} alt="Preview" className="preview-img" />
            ) : (
              <video src={mediaPreview.url} controls className="preview-vid" />
            )}
          </div>

          <div className="preview-options-row">
            <input
              type="text"
              placeholder="Add encrypted caption / notes..."
              value={mediaPreview.caption}
              onChange={(e) => setMediaPreview({ ...mediaPreview, caption: e.target.value })}
              className="preview-caption-input"
              autoFocus
            />

            <button 
              className={`burn-toggle-btn ${mediaPreview.burnAfterRead ? 'active-burn' : ''}`}
              onClick={() => {
                soundFX.playKeypress();
                setMediaPreview({ ...mediaPreview, burnAfterRead: !mediaPreview.burnAfterRead });
              }}
              title="View-Once Self Destruct"
            >
              <Flame size={15} />
              <span>{mediaPreview.burnAfterRead ? 'VIEW-ONCE (5s)' : 'PERSISTENT'}</span>
            </button>

            <button className="preview-send-btn" onClick={handleSendMediaPreview}>
              <Send size={16} />
              <span>TRANSMIT</span>
            </button>
          </div>
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
                <option value="javascript">JavaScript / TypeScript</option>
                <option value="python">Python</option>
                <option value="bash">Bash / Shell</option>
                <option value="rust">Rust</option>
                <option value="c">C / C++ / ASM</option>
                <option value="json">JSON / Config</option>
                <option value="html">HTML / CSS</option>
              </select>
            </div>

            <textarea
              placeholder="// Paste your script, exploit or payload here..."
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
            <span>LIVE INTERCEPT [ 0:{recordSeconds < 10 ? '0' : ''}{recordSeconds} ]</span>
          </div>

          <div className="recording-wave-preview">
            <div className="anim-wave-bar"></div>
            <div className="anim-wave-bar"></div>
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
              title="Attach Encrypted Media & Payloads"
            >
              <Paperclip size={18} />
            </button>

            {showAttachMenu && (
              <div className="attachment-dropdown">
                <button onClick={() => fileInputRef.current?.click()}>
                  <ImageIcon size={15} className="text-accent" /> Photos & Images
                </button>
                <button onClick={() => videoInputRef.current?.click()}>
                  <Video size={15} className="text-warning" /> Video Clip Transmission
                </button>
                <button onClick={() => cameraInputRef.current?.click()}>
                  <Camera size={15} className="text-accent" /> Snap from Camera
                </button>
                <button onClick={() => { setShowCodeModal(true); setShowAttachMenu(false); }}>
                  <Code size={15} /> Code Snippet
                </button>
                <button onClick={() => docInputRef.current?.click()}>
                  <FileText size={15} /> Encrypted Document / Bin
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
                        setText((prev) => prev + ' ' + e);
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
              placeholder={`Transmit encrypted signal to ${activeContact?.name || 'node'}... (Paste image / Drop files)`}
              value={text}
              onChange={handleInputChange}
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
