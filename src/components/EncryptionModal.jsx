import React, { useEffect, useRef } from 'react';
import { ShieldCheck, X } from 'lucide-react';

const EncryptionModal = ({ contact, onClose }) => {
  const closeButtonRef = useRef(null);
  useEffect(() => {
    closeButtonRef.current?.focus();
    const onKeyDown = (event) => {
      if (event.key === 'Escape') onClose();
      if (event.key === 'Tab') {
        event.preventDefault();
        closeButtonRef.current?.focus();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  return (
    <div className="modal-backdrop cyber-modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <section className="cyber-modal encryption-verify-modal" role="dialog" aria-modal="true" aria-labelledby="privacy-dialog-title">
        <div className="modal-header cyber-modal-header">
          <div className="modal-title" id="privacy-dialog-title">
            <ShieldCheck size={18} className="text-accent" />
            <span>Encryption and privacy</span>
          </div>
          <button ref={closeButtonRef} type="button" className="btn-close cyber-modal-close" onClick={onClose} aria-label="Close privacy details">
            <X size={18} />
          </button>
        </div>

        <div className="encryption-body">
          <div className="security-status-banner">
            <div className="status-icon-ring"><ShieldCheck size={24} className="text-accent" /></div>
            <div className="status-meta">
              <h4>Direct encrypted relay transmissions</h4>
              <p>
                Chatforge transmits signals and attachments over your dedicated private WebSocket relay. Direct peer transmissions are protected, and offline payloads are held in an isolated store-and-forward mailbox until the recipient reconnects.
              </p>
            </div>
          </div>
          <div className="fingerprint-section">
            <div className="fp-row">
              <span className="fp-label">Recipient Codename</span>
              <span className="fp-val">{contact?.name || contact?.tag || 'No conversation selected'}</span>
            </div>
            <p className="box-desc">
              <strong>Verify the operator's codename before transmitting sensitive payloads.</strong> Traffic is routed through your self-hosted instance without third-party tracking, telemetry, or external cloud services.
            </p>
          </div>
        </div>

        <div className="cyber-modal-footer">
          <button type="button" className="cyber-btn btn-primary" onClick={onClose}>Close</button>
        </div>
      </section>
    </div>
  );
};

export default EncryptionModal;
