'use client';

import { useState, useRef, useEffect } from 'react';
import { AppHeader, useTranslation } from '@alfheim/shared';
import { useAuth } from '@/core/providers';

/**
 * Dashboard Header utilizing the unified @alfheim/shared AppHeader layout.
 */
export function Header() {
  const { t } = useTranslation();
  const { user, logout } = useAuth();
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [notifications] = useState<{ id: string; title: string; body: string }[]>([]);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const unreadCount = notifications.length;

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setNotificationsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const authUser = user ? {
    name: user.name,
    preferred_username: user.preferred_username,
    email: user.email,
  } : null;

  return (
    <AppHeader
      appName="dashboard"
      brandTitle="ALFHEIM // DASHBOARD"
      brandSubtitle={t('header.brand_subtitles.dashboard')}
      showBackToDashboard={false}
      user={authUser}
      onLogout={logout}
      centerSlot={
        <div className="relative w-full max-w-sm">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-[var(--text-muted)]">
            <span className="material-symbols-outlined text-base">search</span>
          </div>
          <input
            type="text"
            placeholder={t('common.search_placeholder')}
            className="w-full pl-9 pr-10 py-1.5 bg-[var(--surface-canvas)] border border-[var(--border-subtle)] rounded-lg text-xs text-[var(--text-main)] placeholder-[var(--text-muted)] focus:outline-none focus:border-[var(--primary-main)]"
          />
          <div className="absolute inset-y-0 right-0 pr-2 flex items-center pointer-events-none">
            <kbd className="px-1.5 py-0.5 text-[10px] font-mono text-[var(--text-muted)] bg-[var(--surface-elevated)] border border-[var(--border-subtle)] rounded">
              ⌘K
            </kbd>
          </div>
        </div>
      }
      notificationSlot={
        <div className="relative" ref={dropdownRef}>
          <button
            onClick={() => setNotificationsOpen(!notificationsOpen)}
            type="button"
            className="relative p-1.5 rounded-lg bg-[var(--surface-canvas)] border border-[var(--border-subtle)] hover:border-[var(--primary-main)]/50 text-[var(--text-muted)] hover:text-[var(--text-main)] transition-all duration-200 cursor-pointer"
            aria-label={t('header.notifications')}
          >
            <span className="material-symbols-outlined text-lg">notifications</span>
            {unreadCount > 0 && (
              <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-[var(--primary-main)] shadow-[0_0_6px_var(--primary-main)]" />
            )}
          </button>

          {notificationsOpen && (
            <div className="absolute right-0 mt-2 w-80 bg-[var(--surface-card)] border border-[var(--border-subtle)] rounded-xl shadow-2xl p-4 z-50 animate-in fade-in slide-in-from-top-2 duration-200">
              <div className="flex items-center justify-between pb-3 border-b border-[var(--border-subtle)]">
                <span className="text-xs font-semibold uppercase font-mono text-[var(--text-main)]">
                  {t('header.notifications')} ({unreadCount})
                </span>
                <button
                  onClick={() => setNotificationsOpen(false)}
                  className="text-[var(--text-muted)] hover:text-[var(--text-main)] cursor-pointer"
                >
                  <span className="material-symbols-outlined text-base">close</span>
                </button>
              </div>

              <div className="py-4 text-center text-xs font-mono text-[var(--text-muted)]">
                {t('dashboard.empty_notifications')}
              </div>
            </div>
          )}
        </div>
      }
    />
  );
}
