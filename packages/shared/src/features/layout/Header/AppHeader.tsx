'use client';

import React from 'react';
import { BackToDashboard } from './BackToDashboard';
import { LanguageSwitcher } from '../../i18n/components/LanguageSwitcher';
import { ThemeToggle } from '../../theme/components/ThemeToggle';
import { AuthControls, UserIdentity } from './AuthControls';
import { HouseholdSwitcher } from '../../ui/components/HouseholdSwitcher';
import { AlfheimLogo } from '../../ui/components/AlfheimLogo';

export interface AppHeaderProps {
  brandTitle?: string;
  brandSubtitle?: string;
  brandIcon?: React.ReactNode;
  showBackToDashboard?: boolean;
  backToDashboardHref?: string;
  leftSlot?: React.ReactNode;
  centerSlot?: React.ReactNode;
  showHouseholdSwitcher?: boolean;
  showLanguageSwitcher?: boolean;
  showThemeToggle?: boolean;
  showAuthControls?: boolean;
  user?: UserIdentity | null;
  onLogout?: () => void;
  actionsSlot?: React.ReactNode;
  className?: string;
  children?: React.ReactNode;
}

const getFallbackDashboardUrl = (): string => {
  if (typeof globalThis !== 'undefined' && (globalThis as Record<string, any>).process?.env?.NEXT_PUBLIC_FRONTEND_URL) {
    return (globalThis as Record<string, any>).process.env.NEXT_PUBLIC_FRONTEND_URL;
  }
  return '/';
};

/**
 * Universal Unified Application Header Component.
 * Standardizes system chrome across all microfrontends and shell apps:
 * - Left: [BackToDashboard] + [Brand Icon / Fallback AlfheimLogo] + [Brand Title / Subtitle] + [Custom Left Slot]
 * - Center: [Search Bar / Custom Center Slot]
 * - Right: [HouseholdSwitcher] + [LanguageSwitcher] + [ThemeToggle] + [AuthControls / Avatar] + [Custom Actions]
 */
export function AppHeader({
  brandTitle = 'Alfheim OS',
  brandSubtitle = 'Nordic Dark',
  brandIcon,
  showBackToDashboard = true,
  backToDashboardHref,
  leftSlot,
  centerSlot,
  showHouseholdSwitcher = true,
  showLanguageSwitcher = true,
  showThemeToggle = true,
  showAuthControls = true,
  user,
  onLogout,
  actionsSlot,
  className = '',
  children,
}: AppHeaderProps) {
  const resolvedBackHref = backToDashboardHref ?? getFallbackDashboardUrl();

  return (
    <header className={`h-16 bg-[var(--surface-card)] border-b border-[var(--border-subtle)] px-4 sm:px-6 flex items-center justify-between shrink-0 z-30 select-none transition-colors duration-200 ${className}`}>
      {/* Left side: [Brand Identity / Back / App Name / Left Slot] */}
      <div className="flex items-center gap-3">
        {/* Back Link to Portal */}
        {showBackToDashboard && (
          <div className="flex items-center">
            <BackToDashboard href={resolvedBackHref} />
          </div>
        )}

        {/* Brand Icon & Typography */}
        <div className="flex items-center gap-2.5">
          {brandIcon ? (
            <div className="w-8 h-8 rounded-lg bg-[var(--primary-main)]/10 border border-[var(--border-accent)] flex items-center justify-center text-[var(--primary-main)] shrink-0 shadow-[0_0_12px_var(--accent-glow)]">
              {brandIcon}
            </div>
          ) : (
            <AlfheimLogo variant="mark" size={32} />
          )}

          <div className="hidden xs:flex flex-col leading-tight">
            <span className="font-bold text-sm tracking-wider uppercase text-[var(--text-main)] font-sans">
              {brandTitle}
            </span>
            {brandSubtitle && (
              <span className="text-[10px] text-[var(--text-muted)] font-mono">
                {brandSubtitle}
              </span>
            )}
          </div>
        </div>

        {/* Custom Left Slot */}
        {leftSlot && (
          <div className="ml-2 pl-3 border-l border-[var(--border-subtle)] flex items-center">
            {leftSlot}
          </div>
        )}

        {/* Legacy children support */}
        {children && (
          <div className="flex items-center">
            {children}
          </div>
        )}
      </div>

      {/* Center Slot (e.g. Search / Page Filters) */}
      {centerSlot && (
        <div className="hidden md:flex items-center justify-center flex-1 max-w-md mx-4">
          {centerSlot}
        </div>
      )}

      {/* Right side: [HouseholdSwitcher] + [LanguageSwitcher] + [ThemeToggle] + [AuthControls] + [Actions] */}
      <div className="flex items-center gap-2 sm:gap-3">
        {showHouseholdSwitcher && <HouseholdSwitcher />}
        {showLanguageSwitcher && <LanguageSwitcher variant="dropdown" />}
        {showThemeToggle && <ThemeToggle showVariantToggle={true} />}
        {showAuthControls && <AuthControls user={user} onLogout={onLogout} />}
        {actionsSlot}
      </div>
    </header>
  );
}
