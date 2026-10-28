import { ArrowRight } from 'lucide-react';
import type { ScreenId } from '@/navigation';

interface DashboardProps {
  onNavigate: (id: ScreenId) => void;
}

export default function Dashboard({ onNavigate }: DashboardProps) {
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
    </div>
  );
}
