'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useTranslation } from '@loeger-os/shared';

interface NavItem {
  key: string;
  href: string;
  icon: string;
}

const NAV_ITEMS: NavItem[] = [
  { key: 'nav.dashboard', href: '/', icon: 'dashboard' },
  { key: 'nav.profile', href: '/profile', icon: 'person' },
  { key: 'nav.household', href: '/household', icon: 'home_app_logo' },
  { key: 'nav.settings', href: '/settings', icon: 'settings' },
];

/**
 * Mobile Bottom Navigation Bar component for screens smaller than `md` (768px).
 * Displays a fixed bottom bar with active indicator pills adhering to Stitch Obsidian design.
 */
export function BottomNavBar() {
  const pathname = usePathname();
  const { t } = useTranslation();

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 h-16 bg-[var(--surface-card)]/95 backdrop-blur-md border-t border-[var(--border-subtle)] px-2 flex items-center justify-around z-40 select-none shadow-[0_-4px_20px_rgba(0,0,0,0.4)]">
      {NAV_ITEMS.map((item) => {
        const isActive =
          pathname === item.href || (item.href !== '/' && pathname.startsWith(item.href));

        return (
          <Link
            key={item.key}
            href={item.href}
            className={`relative flex flex-col items-center justify-center flex-1 h-full py-1 transition-all duration-200 ${
              isActive
                ? 'text-[var(--primary-main)] font-bold'
                : 'text-[var(--text-muted)] hover:text-[var(--text-main)]'
            }`}
          >
            {/* Top Active Indicator Pill */}
            {isActive && (
              <span className="absolute top-0 w-8 h-1 bg-[var(--primary-main)] rounded-b-full shadow-[0_0_8px_var(--primary-main)]" />
            )}

            <span
              className={`material-symbols-outlined text-xl transition-transform duration-200 ${
                isActive ? 'scale-110' : ''
              }`}
            >
              {item.icon}
            </span>
            <span className="text-[10px] font-mono tracking-tight mt-0.5">{t(item.key)}</span>
          </Link>
        );
      })}
    </nav>
  );
}

