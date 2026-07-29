'use client';

import React from 'react';
import { BackToDashboard } from './BackToDashboard';
import { LanguageSwitcher } from '../../i18n/components/LanguageSwitcher';
import { ThemeToggle } from '../../theme/components/ThemeToggle';
import { AuthControls, UserIdentity } from './AuthControls';

export interface GlobalHeaderProps {
  brandTitle?: string;
  brandSubtitle?: string;
  showBackToDashboard?: boolean;
  backToDashboardHref?: string;
  showLanguageSwitcher?: boolean;
  showThemeToggle?: boolean;
  showAuthControls?: boolean;
  user?: UserIdentity | null;
  onLogout?: () => void;
  className?: string;
  children?: React.ReactNode;
}

export function GlobalHeader({
  brandTitle = 'Loeger OS',
  brandSubtitle = 'Obsidian Flux',
  showBackToDashboard = true,
  backToDashboardHref = '/',
  showLanguageSwitcher = true,
  showThemeToggle = true,
  showAuthControls = true,
  user,
  onLogout,
  className = '',
  children,
}: GlobalHeaderProps) {
  return (
    <header className={`h-16 bg-[var(--surface-card)] border-b border-[var(--border-subtle)] px-4 sm:px-6 flex items-center justify-between shrink-0 z-20 select-none ${className}`}>
      {/* Brand Identity & Back Link */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-[var(--primary-main)]/10 border border-[var(--border-accent)] flex items-center justify-center text-[var(--primary-main)] shadow-[0_0_12px_var(--accent-glow)]">
            <span className="material-symbols-outlined text-xl">blur_on</span>
          </div>
          <div className="hidden xs:flex flex-col">
            <span className="font-bold text-sm tracking-wider uppercase text-[var(--text-main)]">
              {brandTitle}
            </span>
            {brandSubtitle && (
              <span className="text-[10px] text-[var(--text-muted)] font-mono">
                {brandSubtitle}
              </span>
            )}
          </div>
        </div>

        {showBackToDashboard && (
          <div className="ml-2 pl-3 border-l border-[var(--border-subtle)]">
            <BackToDashboard href={backToDashboardHref} />
          </div>
        )}
      </div>

      {/* Custom Children or Center slot */}
      {children && <div className="hidden md:flex items-center flex-1 mx-4">{children}</div>}

      {/* Control Tools */}
      <div className="flex items-center gap-2 sm:gap-3">
        {showLanguageSwitcher && <LanguageSwitcher />}
        {showThemeToggle && <ThemeToggle />}
        {showAuthControls && <AuthControls user={user} onLogout={onLogout} />}
      </div>
    </header>
  );
}
