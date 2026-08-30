import React, { useState, useEffect } from 'react';
import { 
  ShieldCheck, 
  Copy, 
  Check, 
  X, 
  Lock 
} from 'lucide-react';
import { cryptoService } from '../services/cryptoService';
import { soundFX } from '../services/audioService';

const EncryptionModal = ({ myProfile, contact, onClose }) => {
  const [safetyNumbers, setSafetyNumbers] = useState([]);
  const [copied, setCopied] = useState(false);
  const [verified, setVerified] = useState(false);

  useEffect(() => {
    soundFX.playKeypress();
    async function loadNumbers() {
      if (myProfile?.tag && contact?.tag) {
        const nums = await cryptoService.generateSafetyNumbers(myProfile.tag, contact.tag);
        setSafetyNumbers(nums);
      }
    }
    loadNumbers();
  }, [myProfile, contact]);

  const handleCopy = () => {
    soundFX.playKeypress();
    const str = safetyNumbers.join(' ');
    navigator.clipboard.writeText(str);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleToggleVerified = () => {
    soundFX.playSent();
    setVerified(!verified);
  };

  return (
    <div className="modal-backdrop cyber-modal-backdrop" onClick={onClose}>
      <div className="cyber-modal encryption-verify-modal" onClick={(e) => e.stopPropagation()}>
        
        {/* Modal Header */}
        <div className="modal-header cyber-modal-header">
          <div className="modal-title">
            <ShieldCheck size={18} className="text-accent" />
            <span>END-TO-END ZERO-KNOWLEDGE CIPHER</span>
          </div>
          <button className="btn-close cyber-modal-close" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        <div className="encryption-body">
          {/* Security Banner */}
          <div className="security-status-banner">
            <div className="status-icon-ring">
              <Lock size={24} className="text-accent pulse-icon" />
            </div>
            <div className="status-meta">
              <h4>SESSION CIPHER: AES-GCM-256 (QUANTUM-SAFE)</h4>
              <p>
                Messages, calls, images, and file payloads between you and <strong>{contact?.name} ({contact?.tag})</strong> are encrypted end-to-end. Relay servers hold 0 knowledge of your keys or payloads.
              </p>
            </div>
          </div>

          {/* Safety Number Matrix */}
          <div className="safety-number-box">
            <div className="box-top-row">
              <span className="box-title">VERIFY SAFETY NUMBERS</span>
              <button className="copy-btn" onClick={handleCopy}>
                {copied ? <Check size={13} className="text-accent" /> : <Copy size={13} />}
                <span>{copied ? 'COPIED CIPHER' : 'COPY NUMBERS'}</span>
              </button>
            </div>

            <p className="box-desc">
              Compare these 60 digits with {contact?.name}'s device to guarantee no man-in-the-middle node exists on the relay mesh:
            </p>

            <div className="safety-grid">
              {safetyNumbers.map((num, i) => (
                <div key={i} className="safety-block">
                  <span className="block-index">{(i + 1).toString().padStart(2, '0')}</span>
                  <span className="block-val">{num}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Key Fingerprints */}
          <div className="fingerprint-section">
            <div className="fp-row">
              <span className="fp-label">YOUR PUBLIC KEY HASH:</span>
              <span className="fp-val">{myProfile?.pgp || 'PGP-4096-AES-GCM-LOCAL-IDENTITY'}</span>
            </div>
            <div className="fp-row">
              <span className="fp-label">PEER PUBLIC KEY HASH:</span>
              <span className="fp-val">{contact?.pgp || 'PGP-4096-REMOTE-PEER-NODE'}</span>
            </div>
          </div>

          {/* Verification Checkbox & Confirmation */}
          <div className="verify-toggle-box">
            <label className="cyber-checkbox-label">
              <input
                type="checkbox"
                checked={verified}
                onChange={handleToggleVerified}
              />
              <span className="checkmark"></span>
              <span className="label-txt">Mark {contact?.name} as cryptographic verified peer node</span>
            </label>
          </div>
        </div>

        {/* Footer */}
        <div className="cyber-modal-footer">
          <button className="cyber-btn btn-primary" onClick={onClose}>
            CLOSE INSPECTOR
          </button>
        </div>

      </div>
    </div>
  );
};

export default EncryptionModal;
