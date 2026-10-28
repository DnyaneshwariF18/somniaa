import { useCallback, useEffect, useState } from 'react';
import AIBackground from '@/components/AIBackground';
import AppNavigation from '@/components/AppNavigation';
import Dashboard from '@/components/Dashboard';
import Chat from '@/components/Chat';
import {
  DecisionJournalScreen,
  MemoriesScreen,
  MorningReportScreen,
  RemindersScreen,
  SettingsScreen,
  SleepCycleScreen,
} from '@/components/LocalScreens';
import useLocalData from '@/useLocalData';
import type { ScreenId } from '@/navigation';
import { getApiStatus, runServerSleepCycle, sendChatMessage, type ApiStatus } from '@/api';

function App() {
  const [screen, setScreen] = useState<ScreenId>('dashboard');
  const { data, error, update, clear } = useLocalData();
  const [apiStatus, setApiStatus] = useState<ApiStatus | null>(null);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', data.theme);
  }, [data.theme]);

  useEffect(() => {
    let active = true;
    void getApiStatus()
      .then((status) => {
        if (active) {
          const enabled = status.llm.configured && data.allowExternalAI;
          setApiStatus({
            ...status,
            llm: {
              ...status.llm,
              enabled: status.llm.configured && data.allowExternalAI,
              mode: enabled ? 'ai' : 'demo',
            },
          });
        }
      })
      .catch(() => {
        if (active) setApiStatus(null);
      });
    return () => {
      active = false;
    };
  }, [data.allowExternalAI]);

  const navigate = useCallback((id: ScreenId) => {
    setScreen(id);
  }, []);
  const runSleepCycle = useCallback(async () => {
    const updated = await runServerSleepCycle();
    update(updated);
  }, [update]);
  const chatSend = useCallback(
    (text: string, history: Array<{ role: 'user' | 'somnia'; text: string }>) =>
      sendChatMessage(text, history, data.allowExternalAI),
    [data.allowExternalAI],
  );

  const isChat = screen === 'chat';
  const screenProps = { data, update, storageError: error, apiStatus, runSleepCycle };

  const currentScreen = () => {
    switch (screen) {
      case 'dashboard':
        return <Dashboard data={data} onNavigate={navigate} />;
      case 'memories':
        return <MemoriesScreen {...screenProps} />;
      case 'reminders':
        return <RemindersScreen {...screenProps} />;
      case 'sleep-cycle':
        return <SleepCycleScreen {...screenProps} />;
      case 'morning-report':
        return <MorningReportScreen {...screenProps} />;
      case 'decision-journal':
        return <DecisionJournalScreen {...screenProps} />;
      case 'settings':
        return <SettingsScreen {...screenProps} clearData={clear} />;
      case 'chat':
        return null;
    }
  };

  return (
    <div className="relative min-h-screen w-full overflow-x-hidden">
      <AIBackground theme={data.theme} subtle />

      <div className="app-shell">
        <AppNavigation active={screen} onNavigate={navigate} />

        <div className="app-main">
          {isChat ? (
            <div className="app-content app-content--chat">
              {error && (
                <p className="px-4 py-2 text-sm text-rose-200" role="alert">
                  {error}
                </p>
              )}
              <Chat
                messages={data.messages}
                apiStatus={apiStatus}
                onSendMessage={chatSend}
                onMessagesChange={(updater) =>
                  update((previous) => ({
                    ...previous,
                    messages:
                      typeof updater === 'function'
                        ? updater(previous.messages)
                        : updater,
                  }))
                }
              />
            </div>
          ) : (
            <div id="app-content" className="app-content pt-16 md:pt-0">{currentScreen()}</div>
          )}
        </div>
      </div>
    </div>
  );
}

export default App;
