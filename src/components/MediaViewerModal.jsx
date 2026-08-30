import React, { useState, useEffect, useRef } from 'react';
import { 
  X, 
  Download, 
  ZoomIn, 
  ZoomOut, 
  RotateCw, 
  Play, 
  Pause, 
  Volume2, 
  VolumeX, 
  Maximize, 
  Flame, 
  Clock, 
  ShieldCheck 
} from 'lucide-react';
import { soundFX } from '../services/audioService';

const MediaViewerModal = ({ media, onClose, onBurnShred }) => {
  const [zoomLevel, setZoomLevel] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [isPlaying, setIsPlaying] = useState(true);
  const [isMuted, setIsMuted] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const [burnCount, setBurnCount] = useState(
    media?.burnCountdown !== undefined && media?.burnCountdown !== null ? media.burnCountdown : (media?.burnAfterRead ? 10 : null)
  );

  const videoRef = useRef(null);

  useEffect(() => {
    soundFX.playKeypress();
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  // View-once countdown
  useEffect(() => {
    if (burnCount !== null && burnCount > 0) {
      const timer = setTimeout(() => {
        setBurnCount((prev) => prev - 1);
      }, 1000);
      return () => clearTimeout(timer);
    } else if (burnCount === 0) {
      soundFX.playGlitchAlarm();
      if (onBurnShred && media?.id) {
        onBurnShred(media.id);
      }
      onClose();
    }
  }, [burnCount, media, onBurnShred, onClose]);

  const handleDownload = () => {
    soundFX.playSent();
    const a = document.createElement('a');
    a.href = media.mediaUrl || media.text;
    a.download = media.fileName || `chatforge_media_${Date.now()}.${media.type === 'video' ? 'mp4' : 'png'}`;
    document.body.appendChild(a);
    a.click();
    a.remove();
  };

  const handleTogglePlay = () => {
    soundFX.playKeypress();
    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.pause();
      } else {
        videoRef.current.play();
      }
      setIsPlaying(!isPlaying);
    }
  };

  const handleTimeUpdate = () => {
    if (videoRef.current) {
      setCurrentTime(videoRef.current.currentTime);
      setDuration(videoRef.current.duration || 0);
    }
  };

  const handleSeek = (e) => {
    const val = parseFloat(e.target.value);
    if (videoRef.current) {
      videoRef.current.currentTime = val;
      setCurrentTime(val);
    }
  };

  const cycleSpeed = () => {
    soundFX.playKeypress();
    const speeds = [1, 1.25, 1.5, 2];
    const next = speeds[(speeds.indexOf(playbackSpeed) + 1) % speeds.length];
    setPlaybackSpeed(next);
    if (videoRef.current) {
      videoRef.current.playbackRate = next;
    }
  };

  const formatTime = (secs) => {
    if (isNaN(secs)) return '0:00';
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  if (!media) return null;

  const isVideo = media.type === 'video';

  return (
    <div className="media-viewer-overlay" onClick={onClose}>
      <div className="media-viewer-container" onClick={(e) => e.stopPropagation()}>
        
        {/* Top Viewer HUD */}
        <div className="viewer-top-hud">
          <div className="viewer-intel">
            <div className="viewer-badge">
              <ShieldCheck size={14} className="text-accent" />
              <span>{isVideo ? 'ENCRYPTED VIDEO STREAM' : 'ENCRYPTED HIGH-RES IMAGE'}</span>
            </div>
            <span className="viewer-filename">{media.fileName || (isVideo ? 'video_payload.mp4' : 'image_payload.png')}</span>
            {media.fileSize && <span className="viewer-size">[{media.fileSize}]</span>}
          </div>

          {burnCount !== null && (
            <div className="viewer-burn-badge">
              <Flame size={14} className="flame-icon text-danger" />
              <span>SHREDDING IN {burnCount}s</span>
            </div>
          )}

          <div className="viewer-actions">
            {!isVideo && (
              <>
                <button 
                  className="viewer-hud-btn"
                  onClick={() => setZoomLevel((z) => Math.min(z + 0.25, 3))}
                  title="Zoom In"
                >
                  <ZoomIn size={16} />
                </button>
                <button 
                  className="viewer-hud-btn"
                  onClick={() => setZoomLevel((z) => Math.max(z - 0.25, 0.5))}
                  title="Zoom Out"
                >
                  <ZoomOut size={16} />
                </button>
                <button 
                  className="viewer-hud-btn"
                  onClick={() => setRotation((r) => (r + 90) % 360)}
                  title="Rotate"
                >
                  <RotateCw size={16} />
                </button>
              </>
            )}

            <button 
              className="viewer-hud-btn"
              onClick={handleDownload}
              title="Download Encrypted Media"
            >
              <Download size={16} />
            </button>

            <button 
              className="viewer-hud-btn btn-close"
              onClick={onClose}
              title="Close Preview (Esc)"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Media Presentation Canvas */}
        <div className="viewer-canvas">
          {isVideo ? (
            <div className="video-player-box">
              <video
                ref={videoRef}
                src={media.mediaUrl}
                autoPlay
                playsInline
                muted={isMuted}
                onTimeUpdate={handleTimeUpdate}
                onEnded={() => setIsPlaying(false)}
                className="viewer-video-elem"
              />

              {/* Video Bottom Controls Overlay */}
              <div className="video-custom-controls">
                <button className="ctrl-btn" onClick={handleTogglePlay}>
                  {isPlaying ? <Pause size={18} /> : <Play size={18} />}
                </button>

                <div className="video-seekbar-wrap">
                  <input
                    type="range"
                    min="0"
                    max={duration || 100}
                    value={currentTime}
                    onChange={handleSeek}
                    className="video-seek-slider"
                  />
                  <div className="time-display">
                    <span>{formatTime(currentTime)}</span> / <span>{formatTime(duration)}</span>
                  </div>
                </div>

                <button 
                  className="ctrl-btn"
                  onClick={() => {
                    setIsMuted(!isMuted);
                    if (videoRef.current) videoRef.current.muted = !isMuted;
                  }}
                >
                  {isMuted ? <VolumeX size={18} /> : <Volume2 size={18} />}
                </button>

                <button className="ctrl-btn speed-btn" onClick={cycleSpeed}>
                  {playbackSpeed}x
                </button>

                <button 
                  className="ctrl-btn" 
                  onClick={() => {
                    if (videoRef.current?.requestFullscreen) videoRef.current.requestFullscreen();
                  }}
                >
                  <Maximize size={16} />
                </button>
              </div>
            </div>
          ) : (
            <div className="image-viewer-stage">
              <img
                src={media.mediaUrl}
                alt="Encrypted payload"
                className="viewer-img-elem"
                style={{
                  transform: `scale(${zoomLevel}) rotate(${rotation}deg)`,
                  transition: 'transform 0.2s ease',
                }}
              />
            </div>
          )}
        </div>

        {/* Caption & Metadata Footer */}
        <div className="viewer-bottom-bar">
          {media.text && <p className="viewer-caption">{media.text}</p>}
          <div className="viewer-submeta">
            <Clock size={12} />
            <span>Transmitted: {media.timestamp || 'Real-time P2P'}</span>
            {media.checksum && <span>• SHA-256: {media.checksum.substring(0, 18)}...</span>}
          </div>
        </div>

      </div>
    </div>
  );
};

export default MediaViewerModal;
