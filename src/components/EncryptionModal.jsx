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
              <h4>New direct rooms use end-to-end encryption</h4>
              <p>
                Chatforge encrypts room messages on your device with the Matrix Rust crypto SDK. File attachments are encrypted before upload. The homeserver stores ciphertext and an encrypted key backup.
              </p>
            </div>
          </div>
          <div className="fingerprint-section">
            <div className="fp-row">
              <span className="fp-label">Matrix account</span>
              <span className="fp-val">{contact?.name || contact?.tag || 'No conversation selected'}</span>
            </div>
            <p className="box-desc">
              <strong>Verify the other person’s Matrix device before relying on their identity.</strong> The homeserver still sees account IDs, room membership, message timing, IP addresses, and encrypted attachment sizes. Your Matrix account password protects key backup; if you change that password, verify the backup remains accessible in Matrix settings.
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
