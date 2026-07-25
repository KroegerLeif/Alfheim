'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

interface NavItem {
  name: string;
  href: string;
  icon: string;
  badge?: string;
}

const NAV_ITEMS: NavItem[] = [
  { name: 'Dashboard', href: '/', icon: 'dashboard' },
  { name: 'Profile', href: '/profile', icon: 'person' },
  { name: 'Household', href: '/household', icon: 'home_app_logo' },
  { name: 'Settings', href: '/settings', icon: 'settings' },
];

/**
 * Persistent 280px Sidebar component adhering to the Stitch Obsidian Flux design system.
 * Features an active 4px leading indicator pill for selected navigation items.
 */
export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-[280px] h-full bg-[var(--surface-card)] border-r border-[var(--border-subtle)] flex flex-col shrink-0 select-none z-20">
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
          Main Navigation
        </div>

        {NAV_ITEMS.map((item) => {
          const isActive = pathname === item.href || (item.href !== '/' && pathname.startsWith(item.href));

          return (
            <Link
              key={item.name}
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

              <span>{item.name}</span>

              {item.badge && (
                <span className="ml-auto px-2 py-0.5 text-[10px] font-mono rounded-full bg-[var(--primary-main)]/20 text-[var(--primary-main)] border border-[var(--primary-main)]/30">
                  {item.badge}
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      {/* System Status Footer */}
      <div className="p-4 m-3 rounded-xl bg-[var(--surface-canvas)] border border-[var(--border-subtle)] flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <span className="relative flex h-2.5 w-2.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
          </span>
          <span className="text-xs font-mono text-[var(--text-muted)]">
            System Nominal
          </span>
        </div>
        <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-[var(--surface-card)] text-[var(--text-muted)] border border-[var(--border-subtle)]">
          v15.2
        </span>
      </div>
    </aside>
  );
}
