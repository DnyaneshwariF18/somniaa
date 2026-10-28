import { useEffect, useState } from 'react';
import { Moon, Menu, X } from 'lucide-react';
import { NAV_DESTINATIONS } from '@/navigation';
import type { ScreenId } from '@/navigation';

interface AppNavigationProps {
  active: ScreenId;
  onNavigate: (id: ScreenId) => void;
}

export default function AppNavigation({ active, onNavigate }: AppNavigationProps) {
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    document.body.style.overflow = mobileOpen ? 'hidden' : '';
    return () => {
      document.body.style.overflow = '';
    };
  }, [mobileOpen]);

  const go = (id: ScreenId) => {
    onNavigate(id);
    setMobileOpen(false);
  };

  const Brand = (
    <div className="flex items-center gap-2.5 px-2">
      <span
        className="flex h-9 w-9 items-center justify-center rounded-xl"
        style={{
          background: 'rgba(var(--link), 0.16)',
          border: '1px solid rgba(var(--link), 0.25)',
        }}
      >
        <Moon size={18} className="text-[color:var(--accent)]" />
      </span>
      <span className="font-serif-italic text-2xl tracking-wide text-white select-none">
        Somnia
      </span>
    </div>
  );

  const links = NAV_DESTINATIONS.map((d) => {
    const Icon = d.icon;
    const isActive = d.id === active;
    return (
      <button
        key={d.id}
        onClick={() => go(d.id)}
        className={`nav-item ${isActive ? 'nav-item--active' : ''}`}
        aria-current={isActive ? 'page' : undefined}
      >
        <Icon size={18} className="shrink-0" />
        <span className="truncate">{d.label}</span>
      </button>
    );
  });

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="app-sidebar hidden md:flex flex-col gap-1.5 px-4 py-6 sticky top-0 h-screen">
        <div className="mb-6">{Brand}</div>
        <nav className="flex flex-col gap-1.5" aria-label="Primary">
          {links}
        </nav>
        <div className="mt-auto px-2 pt-4 text-[11px]" style={{ color: 'var(--text-faint)' }}>
          <p>Local build — data stays on this device.</p>
        </div>
      </aside>

      {/* Mobile top bar */}
      <div className="md:hidden fixed top-0 left-0 right-0 z-40 flex items-center justify-between px-4 py-3 app-header">
        <div className="flex items-center gap-2">
          <span
            className="flex h-8 w-8 items-center justify-center rounded-lg"
            style={{
              background: 'rgba(var(--link), 0.16)',
              border: '1px solid rgba(var(--link), 0.25)',
            }}
          >
            <Moon size={16} className="text-[color:var(--accent)]" />
          </span>
          <span className="font-serif-italic text-xl tracking-wide text-white">Somnia</span>
        </div>
        <button
          onClick={() => setMobileOpen((v) => !v)}
          aria-label={mobileOpen ? 'Close menu' : 'Open menu'}
          aria-expanded={mobileOpen}
          className="glass flex h-10 w-10 items-center justify-center rounded-full text-white"
        >
          <span className="relative h-5 w-5">
            <Menu
              size={20}
              className={`absolute inset-0 m-auto transition-all duration-300 ${
                mobileOpen ? 'rotate-90 scale-0 opacity-0' : 'rotate-0 scale-100 opacity-100'
              }`}
            />
            <X
              size={20}
              className={`absolute inset-0 m-auto transition-all duration-300 ${
                mobileOpen ? 'rotate-0 scale-100 opacity-100' : '-rotate-90 scale-0 opacity-0'
              }`}
            />
          </span>
        </button>
      </div>

      {/* Mobile drawer */}
      <div
        className={`md:hidden fixed inset-0 z-30 transition-all duration-400 ${
          mobileOpen ? 'pointer-events-auto opacity-100' : 'pointer-events-none opacity-0'
        }`}
        style={{
          background:
            'radial-gradient(120% 90% at 50% 30%, var(--bg-1) 0%, var(--bg-0) 70%, #000 100%)',
          backdropFilter: 'blur(10px)',
        }}
      >
        <div className="flex h-full flex-col gap-2 px-5 pt-24 pb-8">
          {NAV_DESTINATIONS.map((d, i) => {
            const Icon = d.icon;
            const isActive = d.id === active;
            return (
              <button
                key={d.id}
                onClick={() => go(d.id)}
                className={`nav-link-stagger nav-item ${isActive ? 'nav-item--active' : ''}`}
                style={{
                  animationDelay: mobileOpen ? `${0.08 + i * 0.05}s` : '0s',
                  animationPlayState: mobileOpen ? 'running' : 'paused',
                  fontSize: '15px',
                  padding: '14px 16px',
                }}
                aria-current={isActive ? 'page' : undefined}
              >
                <Icon size={20} className="shrink-0" />
                <span>{d.label}</span>
              </button>
            );
          })}
          <p
            className="nav-link-stagger mt-auto px-2 text-[11px]"
            style={{
              color: 'var(--text-faint)',
              animationDelay: mobileOpen ? `${0.08 + NAV_DESTINATIONS.length * 0.05}s` : '0s',
              animationPlayState: mobileOpen ? 'running' : 'paused',
            }}
          >
            Local build — data stays on this device.
          </p>
        </div>
      </div>
    </>
  );
}
