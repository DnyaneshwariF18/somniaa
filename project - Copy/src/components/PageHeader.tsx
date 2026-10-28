import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  icon?: LucideIcon;
  actions?: ReactNode;
}

export default function PageHeader({
  title,
  subtitle,
  icon: Icon,
  actions,
}: PageHeaderProps) {
  return (
    <div className="app-header">
      <div className="flex items-center gap-3 min-w-0">
        {Icon && (
          <span
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl"
            style={{
              background: 'rgba(var(--link), 0.14)',
              border: '1px solid rgba(var(--link), 0.22)',
            }}
          >
            <Icon size={18} className="text-[color:var(--accent)]" />
          </span>
        )}
        <div className="min-w-0">
          <h1 className="font-serif-italic text-2xl sm:text-3xl text-white leading-tight truncate">
            {title}
          </h1>
          {subtitle && (
            <p
              className="text-xs sm:text-sm mt-0.5 truncate"
              style={{ color: 'var(--text-muted)' }}
            >
              {subtitle}
            </p>
          )}
        </div>
      </div>
      {actions && <div className="flex items-center gap-2 shrink-0">{actions}</div>}
    </div>
  );
}
