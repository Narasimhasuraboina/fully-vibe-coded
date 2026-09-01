import React from 'react';
import { Terminal, ShieldCheck, Radio, Zap } from 'lucide-react';

export const EmptyState = ({ onStartChat }) => {
  return (
    <main className="chatarea empty-state">
      <div className="empty-content">
        <div className="radar-glow">
          <Terminal size={48} className="text-accent" />
        </div>

        <h2 className="text-lg font-bold tracking-wider text-text-main mt-4">
          CHATFORGE V2 PROTOCOL // STANDBY
        </h2>

        <p className="desc text-xs text-muted max-w-md text-center mt-2 leading-relaxed">
          Select an active node from the left matrix or establish a new frequency to initiate an end-to-end encrypted messaging session.
        </p>

        <div className="quick-intel-cards mt-6">
          <div className="intel-card">
            <ShieldCheck size={16} className="text-accent" />
            <span>End-to-End Cryptographic Isolation</span>
          </div>
          <div className="intel-card">
            <Radio size={16} className="text-accent" />
            <span>Real-Time Instant Socket Relay</span>
          </div>
          <div className="intel-card">
            <Zap size={16} className="text-accent" />
            <span>Store-and-Forward Offline Delivery</span>
          </div>
        </div>

        {onStartChat && (
          <button
            type="button"
            className="cyber-btn mt-6 py-2 px-4 text-xs font-bold"
            onClick={onStartChat}
          >
            + INITIATE DIRECT COMMS
          </button>
        )}
      </div>
    </main>
  );
};
