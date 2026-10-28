import { useCallback, useEffect, useState } from 'react';
import AIBackground from '@/components/AIBackground';
import AppNavigation from '@/components/AppNavigation';
import Dashboard from '@/components/Dashboard';
import Chat from '@/components/Chat';
import type { ChatMessage } from '@/components/Chat';
import PlaceholderScreen from '@/components/PlaceholderScreen';
import { NAV_MAP } from '@/navigation';
import type { ScreenId } from '@/navigation';

function App() {
  const [theme] = useState<'somnia'>('somnia');
  const [screen, setScreen] = useState<ScreenId>('dashboard');
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  const navigate = useCallback((id: ScreenId) => {
    setScreen(id);
  }, []);

  const dest = NAV_MAP[screen];
  const isChat = screen === 'chat';

  return (
    <div className="relative min-h-screen w-full overflow-x-hidden">
      <AIBackground theme={theme} subtle />

      <div className="app-shell">
        <AppNavigation active={screen} onNavigate={navigate} />

        <div className="app-main">
          {isChat ? (
            <div className="app-content app-content--chat">
              <Chat messages={chatMessages} onMessagesChange={setChatMessages} />
            </div>
          ) : (
            <div id="app-content" className="app-content pt-16 md:pt-0">
              {screen === 'dashboard' ? (
                <Dashboard onNavigate={navigate} />
              ) : (
                <PlaceholderScreen
                  icon={dest.icon}
                  title={dest.label}
                  subtitle={dest.description}
                  description={`This is a placeholder for the ${dest.label} screen. Interactive features will arrive here in a later step.`}
                  onNavigate={navigate}
                />
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default App;
