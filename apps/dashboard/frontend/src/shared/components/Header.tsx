'use client';

import { useState } from 'react';
import { useTheme } from '../providers/ThemeProvider';
import { useAuth } from '../providers/AuthProvider';

/**
 * Top Header component featuring a global search bar, notification trigger,
 * dynamic theme switcher (Obsidian vs Kinetic), and dynamic user identity claims.
 */
export function Header() {
  const { theme, toggleTheme } = useTheme();
  const { user } = useAuth();
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [unreadCount] = useState(3);

  const getInitials = () => {
    if (!user) return 'U';
    if (user.given_name && user.family_name) {
      return `${user.given_name[0]}${user.family_name[0]}`.toUpperCase();
    }
    if (user.preferred_username) {
      return user.preferred_username.substring(0, 2).toUpperCase();
    }
    return 'U';
  };

  return (
    <header className="h-16 bg-[var(--surface-card)] border-b border-[var(--border-subtle)] px-6 flex items-center justify-between shrink-0 z-10">
      {/* Search Bar */}
      <div className="relative w-80 max-w-xs md:max-w-md">
        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-[var(--text-muted)]">
          <span className="material-symbols-outlined text-lg">search</span>
        </div>
        <input
          type="text"
          placeholder="Search system, devices, rules..."
          className="w-full pl-9 pr-12 py-1.5 bg-[var(--surface-canvas)] border border-[var(--border-subtle)] rounded-lg text-xs text-[var(--text-main)] placeholder-[var(--text-muted)] focus:outline-none focus:border-[var(--primary-main)] focus:ring-1 focus:ring-[var(--primary-main)] transition-all duration-200"
        />
        <div className="absolute inset-y-0 right-0 pr-2.5 flex items-center pointer-events-none">
          <kbd className="px-1.5 py-0.5 text-[10px] font-mono text-[var(--text-muted)] bg-[var(--surface-elevated)] border border-[var(--border-subtle)] rounded">
            ⌘K
          </kbd>
        </div>
      </div>

      {/* Header Actions */}
      <div className="flex items-center gap-3">
        {/* Dynamic Theme Toggle (Obsidian vs Kinetic) */}
        <button
          onClick={toggleTheme}
          type="button"
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[var(--surface-canvas)] border border-[var(--border-subtle)] hover:border-[var(--primary-main)]/50 text-xs font-mono text-[var(--text-main)] transition-all duration-200 cursor-pointer group"
          title={`Current Theme: ${theme.toUpperCase()}. Click to toggle.`}
        >
          <span className="material-symbols-outlined text-base text-[var(--primary-main)] group-hover:rotate-180 transition-transform duration-300">
            {theme === 'obsidian' ? 'dark_mode' : 'bolt'}
          </span>
          <span className="capitalize">{theme} Mode</span>
        </button>

        {/* Notification Trigger */}
        <div className="relative">
          <button
            onClick={() => setNotificationsOpen(!notificationsOpen)}
            type="button"
            className="relative p-2 rounded-lg bg-[var(--surface-canvas)] border border-[var(--border-subtle)] hover:border-[var(--primary-main)]/50 text-[var(--text-muted)] hover:text-[var(--text-main)] transition-all duration-200 cursor-pointer"
            aria-label="Notifications"
          >
            <span className="material-symbols-outlined text-xl">notifications</span>
            {unreadCount > 0 && (
              <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-[var(--primary-main)] shadow-[0_0_6px_var(--primary-main)]" />
            )}
          </button>

          {/* Notifications Dropdown */}
          {notificationsOpen && (
            <div className="absolute right-0 mt-2 w-80 bg-[var(--surface-card)] border border-[var(--border-subtle)] rounded-xl shadow-2xl p-4 z-50 animate-in fade-in slide-in-from-top-2 duration-200">
              <div className="flex items-center justify-between pb-3 border-b border-[var(--border-subtle)]">
                <span className="text-xs font-semibold uppercase font-mono text-[var(--text-main)]">
                  Notifications ({unreadCount})
                </span>
                <button
                  onClick={() => setNotificationsOpen(false)}
                  className="text-[var(--text-muted)] hover:text-[var(--text-main)]"
                >
                  <span className="material-symbols-outlined text-base">close</span>
                </button>
              </div>

              <div className="py-2 space-y-2">
                <div className="p-2.5 rounded-lg bg-[var(--surface-elevated)]/60 text-xs">
                  <div className="font-semibold text-[var(--text-main)]">Pantry Service Synced</div>
                  <div className="text-[var(--text-muted)] mt-0.5">Inventory database update completed successfully.</div>
                </div>
                <div className="p-2.5 rounded-lg bg-[var(--surface-elevated)]/60 text-xs">
                  <div className="font-semibold text-[var(--text-main)]">New Gateway Route</div>
                  <div className="text-[var(--text-muted)] mt-0.5">Proxy rule for /dashboard added to Nginx.</div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* User Identity Avatar */}
        <div className="flex items-center gap-2 pl-2 border-l border-[var(--border-subtle)]">
          <div
            className="w-8 h-8 rounded-full bg-gradient-to-tr from-[#182542] to-[#3eb1ff]/30 border border-[var(--primary-main)]/40 flex items-center justify-center text-xs font-bold text-[var(--primary-main)] font-mono"
            title={user ? `${user.name} (@${user.preferred_username})` : 'Authenticated User'}
          >
            {getInitials()}
          </div>
        </div>
      </div>
    </header>
  );
}
