import React, { useEffect } from 'react';
import { 
  Phone, 
  Video, 
  PhoneOff, 
  ShieldCheck, 
  Radio 
} from 'lucide-react';
import { soundFX } from '../services/audioService';

const IncomingCallAlert = ({ callData, onAccept, onReject }) => {
  useEffect(() => {
    soundFX.playRing();
    const interval = setInterval(() => {
      soundFX.playRing();
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  if (!callData) return null;

  const { callerInfo, callType } = callData;

  return (
    <div className="incoming-call-overlay">
      <div className="cyber-call-hud incoming-call-hud">
        
        {/* Top Status */}
        <div className="hud-top">
          <div className="hud-status-badge alert-blink">
            <Radio size={14} className="pulse-icon text-accent" />
            <span>INCOMING P2P ENCRYPTED CALL</span>
          </div>
          <div className="hud-crypto-badge">
            <ShieldCheck size={14} className="text-accent" />
            <span>AUTHENTICATED OPERATOR</span>
          </div>
        </div>

        {/* Caller Info Stage */}
        <div className="hud-stage incoming-stage">
          <div className="caller-avatar-circle ringing-avatar">
            <img src={callerInfo.avatar} alt={callerInfo.username} />
            <div className="radar-circle-pulse"></div>
            <div className="radar-circle-pulse outer-ring"></div>
          </div>

          <h2 className="caller-name-title">{callerInfo.username}</h2>
          <span className="caller-tag-large">{callerInfo.tag}</span>
          <span className="call-type-badge">
            {callType === 'video' ? <Video size={14} /> : <Phone size={14} />}
            {callType?.toUpperCase()} CALL INTERCEPT REQUEST
          </span>
          <span className="caller-ip-info">ROUTING: {callerInfo.ip || 'ENCRYPTED RELAY'}</span>
        </div>

        {/* Action Controls */}
        <div className="incoming-call-actions">
          <button 
            className="incoming-btn btn-reject"
            onClick={() => {
              soundFX.playGlitchAlarm();
              onReject();
            }}
            title="Decline Call"
          >
            <PhoneOff size={22} />
            <span>DECLINE</span>
          </button>

          {callType === 'video' && (
            <button 
              className="incoming-btn btn-accept-video"
              onClick={() => {
                soundFX.playSent();
                onAccept('video');
              }}
              title="Answer with Video"
            >
              <Video size={22} />
              <span>ACCEPT VIDEO</span>
            </button>
          )}

          <button 
            className="incoming-btn btn-accept-audio"
            onClick={() => {
              soundFX.playSent();
              onAccept('audio');
            }}
            title="Answer Audio Only"
          >
            <Phone size={22} />
            <span>ACCEPT AUDIO</span>
          </button>
        </div>

      </div>
    </div>
  );
};

export default IncomingCallAlert;
