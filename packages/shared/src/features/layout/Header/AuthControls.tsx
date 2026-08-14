'use client';

import React from 'react';
import { useTranslation } from '../../i18n/utils';

export interface UserIdentity {
  name?: string;
  preferred_username?: string;
  email?: string;
  given_name?: string;
  family_name?: string;
}

export interface AuthControlsProps {
  user?: UserIdentity | null;
  onLogout?: () => void;
  showUserInfo?: boolean;
  className?: string;
}

export function AuthControls({
  user,
  onLogout,
  showUserInfo = true,
  className = '',
}: AuthControlsProps) {
  const { t } = useTranslation();

  const getInitials = () => {
    if (!user) return 'LK';
    if (user.given_name && user.family_name) {
      return `${user.given_name[0]}${user.family_name[0]}`.toUpperCase();
    }
    if (user.name) {
      const parts = user.name.trim().split(' ');
      if (parts.length >= 2) {
        return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
      }
      return user.name.substring(0, 2).toUpperCase();
    }
    if (user.preferred_username) {
      return user.preferred_username.substring(0, 2).toUpperCase();
    }
    return 'LK';
  };

  return (
    <div className={`flex items-center gap-2.5 ${className}`}>
      {/* User Initials Avatar Badge */}
      {showUserInfo && (
        <div
          className="w-8 h-8 rounded-lg bg-[var(--surface-elevated)] border border-[var(--border-subtle)] hover:border-[var(--primary-main)]/50 flex items-center justify-center text-xs font-mono font-bold text-[var(--primary-main)] shadow-sm select-none transition-colors"
          title={user?.name || user?.preferred_username || 'Logged In User'}
        >
          {getInitials()}
        </div>
      )}

      {/* Dedicated Exit/Logout Button */}
      {onLogout && (
        <button
          type="button"
          onClick={onLogout}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-950/20 border border-red-800/40 text-red-400 hover:bg-red-900/30 hover:border-red-700/60 text-xs font-mono transition-all duration-200 cursor-pointer shadow-sm"
          title={t('common.logout') || 'Abmelden'}
        >
          <span className="material-symbols-outlined text-sm">logout</span>
          <span className="hidden sm:inline font-semibold">{t('common.logout') || 'Abmelden'}</span>
        </button>
      )}
    </div>
  );
}
