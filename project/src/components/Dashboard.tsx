import { ArrowRight } from 'lucide-react';
import type { ScreenId } from '@/navigation';
import type { LocalData } from '@/localData';

interface DashboardProps {
  data: LocalData;
  onNavigate: (id: ScreenId) => void;
}

export default function Dashboard({ data, onNavigate }: DashboardProps) {
  const nextReminder = data.reminders
    .filter((reminder) => !reminder.completedAt && Date.parse(reminder.dueAt) >= Date.now())
    .sort((a, b) => a.dueAt.localeCompare(b.dueAt))[0];
  const hasActivity =
    data.messages.length > 0 ||
    data.memories.length > 0 ||
    data.reminders.length > 0 ||
    data.decisions.length > 0 ||
    data.sleepRuns.length > 0;

  return (
    <div className="flex min-h-[calc(100vh-120px)] flex-col items-center justify-center px-6 py-16 text-center">
      {/* Soft lavender glow behind the heading */}
      <div
        className="pointer-events-none absolute left-1/2 top-1/2 -z-0 h-[min(60vw,520px)] w-[min(60vw,520px)] -translate-x-1/2 -translate-y-1/2 rounded-full"
        style={{
          background:
            'radial-gradient(circle, rgba(var(--link), 0.16) 0%, transparent 65%)',
          filter: 'blur(40px)',
        }}
        aria-hidden="true"
      />

      {/* Hackathon Track Badge */}
      <div
        className="fade-in mb-4 inline-flex items-center gap-2 rounded-full px-3.5 py-1 text-xs border border-white/10 glass"
        style={{ color: 'var(--text-muted)', animationDelay: '0.05s' }}
      >
        <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
        <span>Personal AI Track · Nebius Token Factory & NVIDIA Nemotron</span>
      </div>

      {/* Small greeting */}
      <p
        className="fade-in mb-5 text-sm sm:text-base font-medium tracking-[0.18em] uppercase"
        style={{ color: 'var(--text-muted)', animationDelay: '0.05s' }}
      >
        Hey there 👋
      </p>

      {/* Main heading */}
      <h1
        className="fade-in font-serif-italic text-5xl sm:text-6xl lg:text-7xl text-white leading-[1.1] mb-5"
        style={{ animationDelay: '0.15s' }}
      >
        Hi, I'm SOMNIA.
      </h1>

      {/* Subtitle */}
      <p
        className="fade-in max-w-md text-base sm:text-lg leading-relaxed mb-10"
        style={{ color: 'var(--text-muted)', animationDelay: '0.28s' }}
      >
        Your personal space to think, reflect, and find clarity.
      </p>

      {/* Prominent button */}
      <button
        onClick={() => onNavigate('chat')}
        className="fade-in group flex items-center gap-2.5 rounded-full px-8 py-4 text-base font-medium text-white transition-all hover:scale-[1.03] active:scale-[0.98]"
        style={{
          background:
            'linear-gradient(135deg, var(--accent), var(--orb-halo))',
          boxShadow: '0 8px 30px rgba(var(--link), 0.3)',
          animationDelay: '0.4s',
        }}
        aria-label="Open Chat"
      >
        Let's talk
        <ArrowRight
          size={19}
          className="transition-transform group-hover:translate-x-1"
        />
      </button>

      {/* Subtle line */}
      <p
        className="fade-in mt-7 text-sm"
        style={{ color: 'var(--text-faint)', animationDelay: '0.52s' }}
      >
        What's on your mind today?
      </p>

      <section className="mt-12 grid w-full max-w-3xl gap-3 text-left sm:grid-cols-2" aria-label="Your local activity">
        {!hasActivity ? (
          <div className="surface-card p-5 text-center sm:col-span-2">
            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
              Your local activity will appear here as you use Somnia. Nothing has been added yet.
            </p>
          </div>
        ) : (
          <>
            <button className="surface-card p-5 text-left" onClick={() => onNavigate('reminders')}>
              <span className="text-xs uppercase tracking-wider" style={{ color: 'var(--text-faint)' }}>Next reminder</span>
              <p className="mt-2 text-sm text-white">
                {nextReminder ? nextReminder.title : 'No upcoming reminders'}
              </p>
              {nextReminder && (
                <p className="mt-1 text-xs" style={{ color: 'var(--text-muted)' }}>
                  {new Date(nextReminder.dueAt).toLocaleString()}
                </p>
              )}
            </button>
            <button className="surface-card p-5 text-left" onClick={() => onNavigate('memories')}>
              <span className="text-xs uppercase tracking-wider" style={{ color: 'var(--text-faint)' }}>Saved memories</span>
              <p className="mt-2 text-sm text-white">{data.memories.length} saved by you</p>
            </button>
            <button className="surface-card p-5 text-left" onClick={() => onNavigate('chat')}>
              <span className="text-xs uppercase tracking-wider" style={{ color: 'var(--text-faint)' }}>Chat</span>
              <p className="mt-2 text-sm text-white">
                {data.messages.length ? `${data.messages.length} saved messages` : 'No saved messages yet'}
              </p>
            </button>
            <button className="surface-card p-5 text-left" onClick={() => onNavigate('decision-journal')}>
              <span className="text-xs uppercase tracking-wider" style={{ color: 'var(--text-faint)' }}>Decision journal</span>
              <p className="mt-2 text-sm text-white">{data.decisions.length} saved decisions</p>
            </button>
            {data.sleepRuns[0] && (
              <button className="surface-card p-5 text-left sm:col-span-2" onClick={() => onNavigate('sleep-cycle')}>
                <span className="text-xs uppercase tracking-wider" style={{ color: 'var(--text-faint)' }}>Last backend review</span>
                <p className="mt-2 text-sm text-white">{new Date(data.sleepRuns[0].startedAt).toLocaleString()}</p>
              </button>
            )}
          </>
        )}
      </section>
    </div>
  );
}
