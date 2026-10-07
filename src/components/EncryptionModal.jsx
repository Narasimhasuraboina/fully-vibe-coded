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
            <span>Connection and privacy</span>
          </div>
          <button ref={closeButtonRef} type="button" className="btn-close cyber-modal-close" onClick={onClose} aria-label="Close privacy details">
            <X size={18} />
          </button>
        </div>

        <div className="encryption-body">
          <div className="security-status-banner">
            <div className="status-icon-ring"><ShieldCheck size={24} className="text-accent" /></div>
            <div className="status-meta">
              <h4>Messages are not end-to-end encrypted</h4>
              <p>
                The relay can read messages and attachments, including items waiting in the offline mailbox. Network encryption depends on your deployment: use HTTPS and WSS with a trusted TLS certificate to protect traffic in transit.
              </p>
            </div>
          </div>
          <div className="fingerprint-section">
            <div className="fp-row">
              <span className="fp-label">Recipient Codename</span>
              <span className="fp-val">{contact?.name || contact?.tag || 'No conversation selected'}</span>
            </div>
            <p className="box-desc">
              <strong>Verify the operator's username before sending sensitive information.</strong> A username check does not verify a cryptographic identity. Do not use this relay for information that requires end-to-end encryption.
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
