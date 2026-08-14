'use client';

import React from 'react';
import { BackToDashboard } from './BackToDashboard';
import { LanguageSwitcher } from '../../i18n/components/LanguageSwitcher';
import { ThemeToggle } from '../../theme/components/ThemeToggle';
import { AuthControls, UserIdentity } from './AuthControls';
import { HouseholdSwitcher } from '../../ui/components/HouseholdSwitcher';
import { AppLogo, AppIdentifier } from '../../ui/components/AppLogo';

export interface AppHeaderProps {
  appName?: AppIdentifier;
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
  notificationSlot?: React.ReactNode;
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
 * Adheres strictly to the standard top navigation bar layout:
 * - Left: [Back to Dashboard] -> [App Logo Badge] -> [App Title · Subtitle Breadcrumb] -> [Left Slot]
 * - Center: [Search Bar / Custom Center Slot]
 * - Right: [HouseholdSwitcher] -> [LanguageSelector (DE/EN/PL)] -> [ThemeToggle] -> [Notification Bell] -> [User Initials Avatar] -> [Logout Button] -> [Actions Slot]
 */
export function AppHeader({
  appName,
  brandTitle = 'Alfheim OS',
  brandSubtitle = 'Obsidian Flux',
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
  notificationSlot,
  actionsSlot,
  className = '',
  children,
}: AppHeaderProps) {
  const resolvedBackHref = backToDashboardHref ?? getFallbackDashboardUrl();

  return (
    <header className={`h-16 bg-[var(--surface-card)] border-b border-[var(--border-subtle)] px-4 sm:px-6 flex items-center justify-between shrink-0 z-30 select-none transition-colors duration-200 ${className}`}>
      {/* Left side: [Back to Dashboard] -> [App Logo Badge] -> [App Title · Subtitle Breadcrumb] */}
      <div className="flex items-center gap-3">
        {/* 1. Back Link to Dashboard */}
        {showBackToDashboard && (
          <div className="flex items-center">
            <BackToDashboard href={resolvedBackHref} />
          </div>
        )}

        {/* 2. App Logo Badge & 3. Title Breadcrumb */}
        <div className="flex items-center gap-2.5">
          <AppLogo appName={appName} customIcon={brandIcon} size={32} />

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

      {/* Right side: [HouseholdSwitcher] -> [LanguageSelector] -> [ThemeToggle] -> [Notifications] -> [User Avatar + Logout] */}
      <div className="flex items-center gap-2 sm:gap-3">
        {/* 1. Household Switcher */}
        {showHouseholdSwitcher && <HouseholdSwitcher />}

        {/* 2. Language Selector dropdown (DE / EN / PL) */}
        {showLanguageSwitcher && <LanguageSwitcher variant="dropdown" />}

        {/* 3. Theme Toggle button */}
        {showThemeToggle && <ThemeToggle showVariantToggle={true} />}

        {/* 4. Notification Bell slot */}
        {notificationSlot}

        {/* 5. User Avatar & 6. Dedicated Logout Button */}
        {showAuthControls && <AuthControls user={user} onLogout={onLogout} />}

        {/* Custom actions slot */}
        {actionsSlot}
      </div>
    </header>
  );
}
