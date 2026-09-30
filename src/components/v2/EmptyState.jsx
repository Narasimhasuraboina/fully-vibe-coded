import React from 'react';
import { MessageSquare, ShieldCheck, Radio, Zap } from 'lucide-react';

export const EmptyState = ({ onStartChat }) => {
  return (
    <section className="chatarea empty-state" aria-label="Conversation workspace">
      <div className="empty-content">
        <div className="radar-glow">
          <MessageSquare size={32} className="text-accent" />
        </div>

        <h2 className="text-lg font-bold tracking-wider text-text-main mt-4">
          Your conversations start here
        </h2>

        <p className="desc text-xs text-muted max-w-md text-center mt-2 leading-relaxed">
          Select a conversation or find someone by username to start messaging.
        </p>

        <div className="quick-intel-cards mt-6">
          <div className="intel-card">
            <ShieldCheck size={16} className="text-accent" />
            <span>Private, account-based conversations</span>
          </div>
          <div className="intel-card">
            <Radio size={16} className="text-accent" />
            <span>Real-time message delivery</span>
          </div>
          <div className="intel-card">
            <Zap size={16} className="text-accent" />
            <span>Offline message delivery</span>
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
    </section>
  );
};
