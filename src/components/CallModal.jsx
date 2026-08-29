import React, { useState, useEffect } from 'react';
import { 
  PhoneOff, 
  Mic, 
  MicOff, 
  Video, 
  VideoOff, 
  ShieldCheck, 
  Radio, 
  Zap
} from 'lucide-react';
import { soundFX } from '../services/audioService';

const CallModal = ({ contact, callType, onClose }) => {
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(callType === 'audio');
  const [isScrambled, setIsScrambled] = useState(false);
  const [duration, setDuration] = useState(0);
  const [callStatus, setCallStatus] = useState('ESTABLISHING P2P HANDSHAKE...');
  const [freqBars, setFreqBars] = useState([30, 60, 45, 80, 100, 70, 90, 50, 65, 85, 40, 75]);

  useEffect(() => {
    soundFX.playRing();
    const ringInterval = setInterval(() => {
      soundFX.playRing();
    }, 2500);

    const connectTimeout = setTimeout(() => {
      clearInterval(ringInterval);
      setCallStatus('CONNECTED // AES-256 ENCRYPTED');
      soundFX.playBeep(880, 'sine', 0.15);
    }, 3000);

    return () => {
      clearInterval(ringInterval);
      clearTimeout(connectTimeout);
    };
  }, []);

  useEffect(() => {
    let interval;
    if (callStatus.startsWith('CONNECTED')) {
      interval = setInterval(() => {
        setDuration(prev => prev + 1);
        setFreqBars(Array.from({ length: 14 }, () => Math.floor(20 + Math.random() * 80)));
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [callStatus]);

  const formatDuration = (sec) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m < 10 ? '0' : ''}${m}:${s < 10 ? '0' : ''}${s}`;
  };

  const handleEndCall = () => {
    soundFX.playGlitchAlarm();
    onClose();
  };

  return (
    <div className="call-modal-overlay">
      <div className="cyber-call-hud">
        {/* Top HUD Bar */}
        <div className="hud-top">
          <div className="hud-status-badge">
            <Radio size={14} className="pulse-icon text-accent" />
            <span>{callStatus}</span>
          </div>

          <div className="hud-crypto-badge">
            <ShieldCheck size={14} className="text-accent" />
            <span>SESSION KEY: {contact.pgp?.substring(0, 12)}</span>
          </div>
        </div>

        {/* Video / Audio Stage */}
        <div className="hud-stage">
          {callType === 'video' && !isVideoOff ? (
            <div className="cyber-video-feed">
              <div className="video-overlay-grid"></div>
              <div className="target-face-box">
                <div className="corner c-tl"></div>
                <div className="corner c-tr"></div>
                <div className="corner c-bl"></div>
                <div className="corner c-br"></div>
                <img src={contact.avatar} alt={contact.name} className="feed-avatar-blur" />
                <span className="face-tag">NODE_LOCK: {contact.name}</span>
              </div>
              <div className="hud-coords">
                LAT: 37.7749° N | LNG: 122.4194° W | FPS: 60 | TRACE: 0%
              </div>
            </div>
          ) : (
            <div className="cyber-audio-stage">
              <div className="caller-avatar-circle">
                <img src={contact.avatar} alt={contact.name} />
                <div className="radar-circle-pulse"></div>
              </div>
              <h3>{contact.name}</h3>
              <span className="caller-tag">{contact.tag}</span>
              <span className="caller-ip">SIGNAL ROUTE: {contact.ip}</span>
            </div>
          )}

          {/* Audio Spectrum Analyzer HUD */}
          <div className="spectrum-hud">
            <span className="spectrum-label">AUDIO FREQ MONITOR (P2P RAW DUMP)</span>
            <div className="spectrum-bars">
              {freqBars.map((val, idx) => (
                <div 
                  key={idx} 
                  className="spec-bar" 
                  style={{ height: `${isMuted ? 4 : val}%` }}
                />
              ))}
            </div>
          </div>

          <div className="call-timer">{formatDuration(duration)}</div>
        </div>

        {/* HUD Controls */}
        <div className="hud-controls">
          <button 
            className={`hud-btn ${isMuted ? 'active-alert' : ''}`}
            onClick={() => { soundFX.playKeypress(); setIsMuted(!isMuted); }}
            title="Mute Audio"
          >
            {isMuted ? <MicOff size={20} /> : <Mic size={20} />}
          </button>

          <button 
            className={`hud-btn ${isVideoOff ? 'active-alert' : ''}`}
            onClick={() => { soundFX.playKeypress(); setIsVideoOff(!isVideoOff); }}
            title="Toggle Video Stream"
          >
            {isVideoOff ? <VideoOff size={20} /> : <Video size={20} />}
          </button>

          <button 
            className={`hud-btn ${isScrambled ? 'active-accent' : ''}`}
            onClick={() => { soundFX.playKeypress(); setIsScrambled(!isScrambled); }}
            title="Voice Scrambler (Morph Frequencies)"
          >
            <Zap size={20} />
          </button>

          <button 
            className="hud-btn btn-terminate"
            onClick={handleEndCall}
            title="End Encrypted Call"
          >
            <PhoneOff size={22} />
          </button>
        </div>
      </div>
    </div>
  );
};

export default CallModal;
