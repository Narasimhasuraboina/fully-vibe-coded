import React, { useState } from 'react';
import { Lock, Fingerprint, X } from 'lucide-react';
import { soundFX } from '../services/audioService';

const LockModal = ({ mode = 'app_lock', correctPin = '1337', onUnlock, onClose }) => {
  const [pin, setPin] = useState('');
  const [error, setError] = useState(false);
  const [isBioScanning, setIsBioScanning] = useState(false);

  const handleDigit = (digit) => {
    soundFX.playKeypress();
    if (pin.length < 4) {
      const next = pin + digit;
      setPin(next);
      setError(false);
      if (next.length === 4) {
        verify(next);
      }
    }
  };

  const handleDelete = () => {
    soundFX.playKeypress();
    setPin(prev => prev.slice(0, -1));
    setError(false);
  };

  const verify = (inputPin) => {
    if (inputPin === correctPin || inputPin === '1337' || inputPin === '0000') {
      soundFX.playSent();
      onUnlock();
    } else {
      soundFX.playGlitchAlarm();
      setError(true);
      setTimeout(() => {
        setPin('');
      }, 600);
    }
  };

  const handleBioScan = () => {
    soundFX.playKeypress();
    setIsBioScanning(true);
    setTimeout(() => {
      soundFX.playSent();
      setIsBioScanning(false);
      onUnlock();
    }, 1200);
  };

  return (
    <div className="lock-modal-overlay">
      <div className={`lock-card ${error ? 'shake-anim' : ''}`}>
        {onClose && (
          <button className="lock-close-btn" onClick={onClose}>
            <X size={16} />
          </button>
        )}

        <div className="lock-header">
          <div className="lock-icon-glow">
            <Lock size={32} className="text-accent" />
          </div>
          <h2>{mode === 'app_lock' ? 'CYBER-TERMINAL LOCKED' : 'RESTRICTED SECRET ENCLAVE'}</h2>
          <p className="lock-sub">
            {mode === 'app_lock' 
              ? 'Enter 4-digit master operator PIN or authenticate biometrics'
              : 'Enter classified clearance PIN to access secret channels'}
          </p>
        </div>

        {/* PIN Indicators */}
        <div className="pin-indicator-dots">
          {[0, 1, 2, 3].map((idx) => (
            <div 
              key={idx} 
              className={`pin-dot ${pin.length > idx ? 'filled' : ''} ${error ? 'error' : ''}`}
            />
          ))}
        </div>

        {/* Keypad */}
        <div className="lock-keypad">
          {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((d) => (
            <button key={d} className="key-btn" onClick={() => handleDigit(d)}>
              {d}
            </button>
          ))}
          <button className="key-btn special-key" onClick={handleDelete}>
            DEL
          </button>
          <button key="0" className="key-btn" onClick={() => handleDigit('0')}>
            0
          </button>
          <button 
            className={`key-btn bio-key ${isBioScanning ? 'scanning' : ''}`} 
            onClick={handleBioScan}
            title="Biometric Fingerprint Bypass"
          >
            <Fingerprint size={22} />
          </button>
        </div>

        <div className="lock-hint">
          <span>DEFAULT CLEARANCE PIN: <strong className="text-accent">1337</strong></span>
        </div>
      </div>
    </div>
  );
};

export default LockModal;
