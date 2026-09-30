import React from 'react';
import { ChatProvider } from './context/ChatContext';
import { useChat } from './context/useChat';
import { Header } from './components/v2/Header';
import { Sidebar } from './components/v2/Sidebar';
import { ChatArea } from './components/v2/ChatArea';
import { AuthScreen } from './components/v2/AuthScreen';
import MatrixBackground from './components/MatrixBackground';
import ToastNotification from './components/ToastNotification';
import BroadcastModal from './components/BroadcastModal';
import ScheduleModal from './components/ScheduleModal';
import EncryptionModal from './components/EncryptionModal';
import MediaGalleryModal from './components/MediaGalleryModal';
import MediaViewerModal from './components/MediaViewerModal';
import ForwardModal from './components/ForwardModal';
import ProfileModal from './components/ProfileModal';
import SearchUserModal from './components/SearchUserModal';
import { THEMES } from './themes';
import './legacy.css';
import './App.css';

function MainAppShell() {
  const {
    currentUser,
    activeContactId,
    activeContact,
    contacts,
    messages,
    theme,
    serverInfo,
    activeModal,
    modalData,
    closeModal,
    openModal,
    addOrSelectContact,
    broadcastMessage,
    scheduleMessage,
    forwardMessage,
    updateProfile,
    shredMessage,
  } = useChat();

  if (!currentUser) {
    return (
      <div className="chatforge-app-root">
        <MatrixBackground enabled={false} color={THEMES[theme]?.accent || '#00ff66'} />
        <ToastNotification />
        <AuthScreen />
      </div>
    );
  }

  const layoutClass = activeContactId ? 'has-active-chat' : 'no-active-chat';

  return (
    <div className="chatforge-app-root">
      <MatrixBackground enabled={true} color={THEMES[theme]?.accent || '#00ff66'} />
      <ToastNotification />
      <Header />

      <main className={`chatforge-main-layout ${layoutClass}`}>
        <Sidebar />
        <ChatArea />
      </main>

      {/* Dynamic Modals */}
      {activeModal === 'broadcast' && (
        <BroadcastModal
          contacts={contacts}
          onClose={closeModal}
          onBroadcastMessage={broadcastMessage}
        />
      )}

      {activeModal === 'schedule' && (
        <ScheduleModal
          contacts={contacts}
          activeContact={activeContact}
          onClose={closeModal}
          onScheduleMessage={scheduleMessage}
        />
      )}

      {activeModal === 'encryption' && (
        <EncryptionModal
          myProfile={currentUser}
          contact={modalData || activeContact}
          onClose={closeModal}
        />
      )}

      {activeModal === 'gallery' && (
        <MediaGalleryModal
          contact={modalData || activeContact}
          messages={messages}
          onClose={closeModal}
          onOpenMedia={(item) => openModal('mediaViewer', item)}
        />
      )}

      {activeModal === 'mediaViewer' && (
        <MediaViewerModal
          media={modalData}
          onClose={closeModal}
          onBurnShred={shredMessage}
        />
      )}

      {activeModal === 'forward' && (
        <ForwardModal
          message={modalData}
          contacts={contacts}
          onClose={closeModal}
          onForwardMessage={forwardMessage}
        />
      )}

      {activeModal === 'profile' && (
        <ProfileModal
          currentProfile={currentUser}
          onSaveProfile={updateProfile}
          onClose={closeModal}
          serverInfo={serverInfo}
        />
      )}

      {activeModal === 'search' && (
        <SearchUserModal
          currentProfile={currentUser}
          existingContacts={contacts}
          onSelectAndAddContact={addOrSelectContact}
          onClose={closeModal}
        />
      )}
    </div>
  );
}

class AppErrorBoundary extends React.Component {
  state = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error) {
    console.error('[APP] Unhandled interface error:', error);
  }

  render() {
    if (this.state.hasError) {
      return (
        <main className="app-error-screen" role="alert">
          <h1>Chatforge ran into a problem</h1>
          <p>Reload the page to reconnect to your conversations.</p>
          <button type="button" onClick={() => window.location.reload()}>Reload Chatforge</button>
        </main>
      );
    }
    return this.props.children;
  }
}

export default function App() {
  return (
    <AppErrorBoundary>
      <ChatProvider>
        <MainAppShell />
      </ChatProvider>
    </AppErrorBoundary>
  );
}
