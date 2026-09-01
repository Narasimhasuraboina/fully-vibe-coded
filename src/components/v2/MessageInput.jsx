import React, { useState, useRef, useEffect } from 'react';
import { Send, Paperclip, Smile, X } from 'lucide-react';
import { useChat } from '../../context/useChat';

const EMOJI_LIST = ['👍', '❤️', '🔥', '⚡', '🤖', '💀', '🛡️', '🔒', '👀', '🚀'];

export const MessageInput = () => {
  const { sendMessage, emitTyping, activeContact } = useChat();
  const [text, setText] = useState('');
  const [attachment, setAttachment] = useState(null);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const fileInputRef = useRef(null);
  const typingTimerRef = useRef(null);

  // Handle typing indicator
  const handleInputChange = (e) => {
    setText(e.target.value);

    emitTyping(true);
    if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
    typingTimerRef.current = setTimeout(() => {
      emitTyping(false);
    }, 1500);
  };

  useEffect(() => {
    return () => {
      if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
    };
  }, []);

  // Handle file select
  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      setAttachment({
        name: file.name,
        size: file.size,
        type: file.type,
        data: reader.result,
      });
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  // Submit message
  const handleSend = (e) => {
    e?.preventDefault();
    if (!text.trim() && !attachment) return;

    sendMessage({
      text: text.trim(),
      type: attachment ? (attachment.type.startsWith('image/') ? 'image' : 'file') : 'text',
      file: attachment,
    });

    setText('');
    setAttachment(null);
    setShowEmojiPicker(false);
    emitTyping(false);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="message-input-bar">
      {/* Attachment Preview Banner */}
      {attachment && (
        <div className="flex items-center justify-between p-2 mb-2 bg-bg-card border border-border rounded text-xs">
          <div className="flex items-center gap-2 overflow-hidden">
            <Paperclip size={14} className="text-accent flex-shrink-0" />
            <span className="truncate text-text-main">{attachment.name}</span>
          </div>
          <button
            type="button"
            className="text-muted hover:text-danger ml-2"
            onClick={() => setAttachment(null)}
          >
            <X size={14} />
          </button>
        </div>
      )}

      {/* Emoji Picker Popover */}
      {showEmojiPicker && (
        <div className="absolute bottom-16 left-4 bg-bg-card border border-border rounded-lg p-2 flex gap-1 shadow-lg z-20">
          {EMOJI_LIST.map((emoji) => (
            <button
              key={emoji}
              type="button"
              className="p-1 hover:scale-125 transition-transform"
              onClick={() => {
                setText((prev) => prev + emoji);
                setShowEmojiPicker(false);
              }}
            >
              {emoji}
            </button>
          ))}
        </div>
      )}

      {/* Input Row */}
      <form onSubmit={handleSend} className="flex items-center gap-2">
        <input
          type="file"
          ref={fileInputRef}
          className="hidden"
          onChange={handleFileChange}
        />

        <button
          type="button"
          className="cyber-btn btn-icon"
          title="Attach File / Image"
          onClick={() => fileInputRef.current?.click()}
        >
          <Paperclip size={16} />
        </button>

        <button
          type="button"
          className="cyber-btn btn-icon"
          title="Insert Emoji"
          onClick={() => setShowEmojiPicker(!showEmojiPicker)}
        >
          <Smile size={16} />
        </button>

        <input
          type="text"
          className="cyber-input flex-1"
          placeholder={activeContact ? `Transmit to ${activeContact.name || activeContact.tag}...` : 'Write message...'}
          value={text}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
        />

        <button
          type="submit"
          disabled={!text.trim() && !attachment}
          className="cyber-btn py-2 px-3 font-bold disabled:opacity-40"
          title="Send Encrypted Message"
        >
          <Send size={15} />
        </button>
      </form>
    </div>
  );
};
