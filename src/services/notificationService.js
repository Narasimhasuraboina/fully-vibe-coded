// Notification Service for Desktop & In-App Alerts
class NotificationService {
  constructor() {
    this.unreadCount = 0;
    this.originalTitle = typeof document !== 'undefined' ? document.title : 'Chatforge';
    this.toastListeners = new Set();
    this.isPageVisible = true;

    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', () => {
        this.isPageVisible = !document.hidden;
        if (this.isPageVisible) {
          this.clearUnreadTitle();
        }
      });
    }
  }

  // Request browser permission for system notifications
  async requestPermission() {
    if (typeof window === 'undefined' || !('Notification' in window)) {
      return 'unsupported';
    }
    if (Notification.permission === 'granted') {
      return 'granted';
    }
    if (Notification.permission !== 'denied') {
      const permission = await Notification.requestPermission();
      return permission;
    }
    return Notification.permission;
  }

  // Show desktop notification
  showDesktopNotification(title, options = {}) {
    if (typeof window === 'undefined' || !('Notification' in window)) return;
    if (Notification.permission === 'granted') {
      try {
        const n = new Notification(title, {
          icon: '/favicon.svg',
          badge: '/favicon.svg',
          tag: options.tag || 'chatforge-msg',
          renotify: true,
          silent: false,
          ...options,
        });

        n.onclick = () => {
          window.focus();
          n.close();
          if (options.onClick) options.onClick();
        };

        // Auto close after 6 seconds
        setTimeout(() => n.close(), 6000);
      } catch (e) {
        console.warn('[NOTIFY] Desktop notification failed:', e);
      }
    }
  }

  // Push an in-app HUD toast notification
  pushToast(toast) {
    const item = {
      id: `toast_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      title: toast.title || 'ENCRYPTED SIGNAL RECEIVED',
      message: toast.message || '',
      type: toast.type || 'info', // 'info' | 'call' | 'security' | 'success' | 'danger'
      avatar: toast.avatar,
      duration: toast.duration || 4500,
      onClick: toast.onClick,
      actionLabel: toast.actionLabel,
      onAction: toast.onAction,
      createdAt: Date.now(),
    };

    this.toastListeners.forEach(listener => listener(item));
    
    // Also bump title badge if user is in background tab
    if (!this.isPageVisible) {
      this.unreadCount++;
      this.updatePageTitle();
    }

    return item.id;
  }

  subscribeToasts(callback) {
    this.toastListeners.add(callback);
    return () => this.toastListeners.delete(callback);
  }

  updatePageTitle() {
    if (typeof document === 'undefined') return;
    if (this.unreadCount > 0) {
      document.title = `(● ${this.unreadCount}) Chatforge // Incoming Intercept`;
    } else {
      document.title = this.originalTitle;
    }
  }

  clearUnreadTitle() {
    this.unreadCount = 0;
    if (typeof document !== 'undefined') {
      document.title = this.originalTitle;
    }
  }
}

export const notificationService = new NotificationService();
