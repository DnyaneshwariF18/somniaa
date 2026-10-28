import type { LucideIcon } from 'lucide-react';
import PageHeader from '@/components/PageHeader';
import type { ScreenId } from '@/navigation';

interface PlaceholderScreenProps {
  icon: LucideIcon;
  title: string;
  subtitle: string;
  description: string;
  onNavigate: (id: ScreenId) => void;
}

export default function PlaceholderScreen({
  icon: Icon,
  title,
  subtitle,
  description,
  onNavigate,
}: PlaceholderScreenProps) {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={title} subtitle={subtitle} icon={Icon} />

      <section className="surface-card fade-in flex flex-col items-center justify-center px-6 py-16 text-center">
        <span
          className="mb-5 flex h-16 w-16 items-center justify-center rounded-2xl"
          style={{
            background: 'rgba(var(--link), 0.12)',
            border: '1px solid rgba(var(--link), 0.22)',
          }}
        >
          <Icon size={28} className="text-[color:var(--accent)]" />
        </span>
        <h2 className="font-serif-italic text-2xl sm:text-3xl text-white mb-3">{title}</h2>
        <p
          className="max-w-md text-sm sm:text-base leading-relaxed"
          style={{ color: 'var(--text-muted)' }}
        >
          {description}
        </p>
        <span className="chip mt-6">Coming soon</span>
        <button
          onClick={() => onNavigate('dashboard')}
          className="mt-6 text-xs transition-colors hover:text-white"
          style={{ color: 'var(--text-muted)' }}
        >
          Back to Dashboard
        </button>
      </section>
    </div>
  );
}
