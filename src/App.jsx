import React from 'react';
import { ChatProvider } from './context/ChatContext';
import { useChat } from './context/useChat';
import { Header } from './components/v2/Header';
import { Sidebar } from './components/v2/Sidebar';
import { ChatArea } from './components/v2/ChatArea';
import { AuthScreen } from './components/v2/AuthScreen';
import MatrixBackground from './components/MatrixBackground';
import { THEMES } from './themes';
import './App.css';

function MainAppShell() {
  const { currentUser, activeContactId, theme } = useChat();

  if (!currentUser) {
    return (
      <div className="chatforge-app-root">
        <MatrixBackground enabled={true} color={THEMES[theme]?.accent || '#00ff66'} />
        <AuthScreen />
      </div>
    );
  }

  const layoutClass = activeContactId ? 'has-active-chat' : 'no-active-chat';

  return (
    <div className="chatforge-app-root">
      <MatrixBackground enabled={true} color={THEMES[theme]?.accent || '#00ff66'} />
      <Header />
      <div className={`chatforge-main-layout ${layoutClass}`}>
        <Sidebar />
        <ChatArea />
      </div>
    </div>
  );
}

export default function App() {
  return (
    <ChatProvider>
      <MainAppShell />
    </ChatProvider>
  );
}
