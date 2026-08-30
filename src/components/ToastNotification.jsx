import React, { useState, useEffect } from 'react';
import { 
  Radio, 
  ShieldAlert, 
  PhoneCall, 
  CheckCircle, 
  X, 
  ArrowRight 
} from 'lucide-react';
import { notificationService } from '../services/notificationService';

const ToastNotification = () => {
  const [toasts, setToasts] = useState([]);

  useEffect(() => {
    const unsubscribe = notificationService.subscribeToasts((newToast) => {
      setToasts((prev) => [newToast, ...prev.slice(0, 4)]);

      // Auto dismiss
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== newToast.id));
      }, newToast.duration);
    });

    return () => unsubscribe();
  }, []);

  const removeToast = (id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  if (toasts.length === 0) return null;

  return (
    <aside aria-label="Notifications" className="cyber-toast-container">
      {toasts.map((toast) => {
        let Icon = Radio;
        let iconClass = 'text-accent';

        if (toast.type === 'call') {
          Icon = PhoneCall;
          iconClass = 'text-warning pulse-icon';
        } else if (toast.type === 'security' || toast.type === 'danger') {
          Icon = ShieldAlert;
          iconClass = 'text-danger animate-pulse';
        } else if (toast.type === 'success') {
          Icon = CheckCircle;
          iconClass = 'text-accent';
        }

        return (
          <div
            key={toast.id}
            className={`cyber-toast-item toast-${toast.type || 'info'}`}
            onClick={() => {
              if (toast.onClick) toast.onClick();
              removeToast(toast.id);
            }}
          >
            <div className="toast-glow-bar"></div>
            
            <div className="toast-icon-side">
              {toast.avatar ? (
                <img src={toast.avatar} alt="Sender" className="toast-avatar" />
              ) : (
                <div className="toast-badge-icon">
                  <Icon size={18} className={iconClass} />
                </div>
              )}
            </div>

            <div className="toast-body">
              <div className="toast-header-row">
                <span className="toast-title">{toast.title}</span>
                <span className="toast-time">NOW</span>
              </div>
              <p className="toast-msg">{toast.message}</p>

              {toast.actionLabel && (
                <button 
                  className="toast-action-btn"
                  onClick={(e) => {
                    e.stopPropagation();
                    if (toast.onAction) toast.onAction();
                    removeToast(toast.id);
                  }}
                >
                  <span>{toast.actionLabel}</span>
                  <ArrowRight size={12} />
                </button>
              )}
            </div>

            <button 
              className="toast-close-btn"
              onClick={(e) => {
                e.stopPropagation();
                removeToast(toast.id);
              }}
            >
              <X size={14} />
            </button>
          </div>
        );
      })}
    </aside>
  );
};

export default ToastNotification;
