'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useTranslation } from '@loeger-os/shared';
import { useAuth } from '@/core/providers';

interface NavItemConfig {
  key: string;
  defaultName: string;
  href: string;
  icon: string;
  badge?: string;
}

const NAV_CONFIG: NavItemConfig[] = [
  { key: 'nav.dashboard', defaultName: 'Dashboard', href: '/', icon: 'dashboard' },
  { key: 'nav.profile', defaultName: 'Profile', href: '/profile', icon: 'person' },
  { key: 'nav.household', defaultName: 'Household', href: '/household', icon: 'home_app_logo' },
  { key: 'nav.settings', defaultName: 'Settings', href: '/settings', icon: 'settings' },
];

/**
 * Persistent 280px Sidebar component adhering to the Stitch Obsidian Flux design system.
 * Features an active 4px leading indicator pill for selected navigation items, user session identity, and logout.
 */
export function Sidebar() {
  const pathname = usePathname();
  const { t } = useTranslation();
  const { user, logout } = useAuth();

  return (
    <aside className="hidden md:flex w-[280px] h-full bg-[var(--surface-card)] border-r border-[var(--border-subtle)] flex-col shrink-0 select-none z-20">
      {/* Brand Header */}
      <div className="h-16 px-6 flex items-center gap-3 border-b border-[var(--border-subtle)]">
        <div className="w-8 h-8 rounded-lg bg-[var(--primary-main)]/10 border border-[var(--border-accent)] flex items-center justify-center text-[var(--primary-main)] shadow-[0_0_12px_var(--accent-glow)]">
          <span className="material-symbols-outlined text-xl">blur_on</span>
        </div>
        <div className="flex flex-col">
          <span className="font-bold text-sm tracking-wider uppercase text-[var(--text-main)]">
            Loeger OS
          </span>
          <span className="text-[11px] text-[var(--text-muted)] font-mono">
            Obsidian Flux v1.0
          </span>
        </div>
      </div>

      {/* Navigation Links */}
      <nav className="flex-1 py-6 px-3 space-y-1.5 overflow-y-auto">
        <div className="px-3 pb-2 text-[10px] font-mono uppercase tracking-widest text-[var(--text-muted)]">
          {t('nav.main_navigation')}
        </div>

        {NAV_CONFIG.map((item) => {
          const isActive = pathname === item.href || (item.href !== '/' && pathname.startsWith(item.href));
          const translatedName = t(item.key);

          return (
            <Link
              key={item.key}
              href={item.href}
              className={`relative flex items-center gap-3.5 px-3.5 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 group ${
                isActive
                  ? 'bg-[var(--surface-elevated)] text-[var(--text-main)] shadow-[0_0_15px_rgba(0,0,0,0.2)]'
                  : 'text-[var(--text-muted)] hover:text-[var(--text-main)] hover:bg-[var(--surface-elevated)]/50'
              }`}
            >
              {/* Active 4px Leading Indicator Pill */}
              {isActive && (
                <span className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 bg-[var(--primary-main)] rounded-r-full shadow-[0_0_10px_var(--primary-main)]" />
              )}

              <span
                className={`material-symbols-outlined text-xl transition-colors duration-200 ${
                  isActive
                    ? 'text-[var(--primary-main)]'
                    : 'text-[var(--text-muted)] group-hover:text-[var(--text-main)]'
                }`}
              >
                {item.icon}
              </span>

              <span>{translatedName}</span>

              {item.badge && (
                <span className="ml-auto px-2 py-0.5 text-[10px] font-mono rounded-full bg-[var(--primary-main)]/20 text-[var(--primary-main)] border border-[var(--primary-main)]/30">
                  {item.badge}
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      {/* User Session & Logout Footer */}
      <div className="p-3 m-3 space-y-2 rounded-xl bg-[var(--surface-canvas)] border border-[var(--border-subtle)]">
        {user && (
          <div className="flex items-center justify-between px-1">
            <div className="flex flex-col truncate">
              <span className="text-xs font-semibold text-[var(--text-main)] truncate">
                {user.name}
              </span>
              <span className="text-[10px] font-mono text-[var(--text-muted)] truncate">
                @{user.preferred_username}
              </span>
            </div>
          </div>
        )}

        <button
          onClick={logout}
          type="button"
          className="w-full flex items-center justify-center gap-2 px-3 py-1.5 rounded-lg bg-red-950/20 border border-red-800/40 text-red-400 hover:bg-red-900/30 text-xs font-mono transition-all duration-200 cursor-pointer"
        >
          <span className="material-symbols-outlined text-sm">logout</span>
          <span>{t('common.logout')}</span>
        </button>
      </div>
    </aside>
  );
}
