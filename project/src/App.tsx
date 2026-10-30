import { useCallback, useEffect, useRef, useState } from 'react';
import { Bell, Check, X } from 'lucide-react';
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
  const [dismissedReminderIds, setDismissedReminderIds] = useState<Set<string>>(() => new Set());
  const notifiedReminderIds = useRef<Set<string>>(new Set());
  const [clock, setClock] = useState(() => Date.now());

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', data.theme);
  }, [data.theme]);

  useEffect(() => {
    const timer = setInterval(() => setClock(Date.now()), 5000);
    return () => clearInterval(timer);
  }, []);

  const dueReminders = data.reminders.filter(
    (r) => !r.completedAt && Date.parse(r.dueAt) <= clock,
  );
  const dueReminderCount = dueReminders.length;
  const activeDueReminder = dueReminders.find((r) => !dismissedReminderIds.has(r.id));

  // Desktop notification trigger
  useEffect(() => {
    if (typeof window === 'undefined' || !('Notification' in window)) return;
    if (Notification.permission !== 'granted') return;

    for (const r of dueReminders) {
      if (!notifiedReminderIds.current.has(r.id)) {
        notifiedReminderIds.current.add(r.id);
        try {
          new Notification(`Somnia: ${r.title}`, {
            body: r.details || 'Your reminder is due now.',
          });
        } catch {
          // Browser notification restriction fallback
        }
      }
    }
  }, [dueReminders]);

  const completeReminder = useCallback((id: string) => {
    update((previous) => ({
      ...previous,
      reminders: previous.reminders.map((item) =>
        item.id === id ? { ...item, completedAt: new Date().toISOString() } : item,
      ),
    }));
  }, [update]);

  const snoozeReminder = useCallback((id: string) => {
    update((previous) => ({
      ...previous,
      reminders: previous.reminders.map((item) =>
        item.id === id
          ? { ...item, dueAt: new Date(Date.now() + 10 * 60 * 1000).toISOString() }
          : item,
      ),
    }));
  }, [update]);

  const dismissReminder = useCallback((id: string) => {
    setDismissedReminderIds((prev) => new Set(prev).add(id));
  }, []);

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

      {activeDueReminder && (
        <div
          role="alert"
          aria-live="polite"
          className="fixed top-4 right-4 left-4 md:left-auto md:w-96 z-50 rounded-2xl border border-amber-500/40 bg-zinc-950/95 p-4 shadow-2xl backdrop-blur-md"
        >
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-2.5">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-amber-500/20 text-amber-300">
                <Bell size={15} />
              </span>
              <div>
                <span className="text-[11px] font-semibold uppercase tracking-wider text-amber-300">
                  Reminder Due
                </span>
                <h4 className="text-sm font-medium text-white">{activeDueReminder.title}</h4>
                {activeDueReminder.details && (
                  <p className="mt-1 text-xs text-white/70 line-clamp-2">{activeDueReminder.details}</p>
                )}
              </div>
            </div>
            <button
              onClick={() => dismissReminder(activeDueReminder.id)}
              className="text-white/40 hover:text-white"
              aria-label="Dismiss reminder notification"
            >
              <X size={15} />
            </button>
          </div>
          <div className="mt-3 flex items-center justify-end gap-2 border-t border-white/10 pt-2.5">
            <button
              onClick={() => snoozeReminder(activeDueReminder.id)}
              className="glass rounded-full px-3 py-1 text-xs text-white/80 hover:text-white"
            >
              Snooze 10m
            </button>
            <button
              onClick={() => completeReminder(activeDueReminder.id)}
              className="inline-flex items-center gap-1 rounded-full border border-emerald-500/40 bg-emerald-500/20 px-3 py-1 text-xs font-medium text-emerald-300 hover:bg-emerald-500/30"
            >
              <Check size={12} /> Complete
            </button>
          </div>
        </div>
      )}

      <div className="app-shell">
        <AppNavigation active={screen} onNavigate={navigate} dueReminderCount={dueReminderCount} />

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
                onMemorySaved={(newMemory) =>
                  update((previous) => ({
                    ...previous,
                    memories: [newMemory, ...previous.memories.filter((m) => m.id !== newMemory.id)],
                  }))
                }
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
