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
    if (!user) return 'U';
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
    return 'U';
  };

  return (
    <div className={`flex items-center gap-3 ${className}`}>
      {showUserInfo && user && (
        <div className="flex items-center gap-2 pr-2 border-r border-[var(--border-subtle)]">
          <div
            className="w-7 h-7 rounded-full bg-gradient-to-tr from-[#182542] to-[#3eb1ff]/30 border border-[var(--primary-main)]/40 flex items-center justify-center text-xs font-bold text-[var(--primary-main)] font-mono"
            title={user.name || user.preferred_username || 'User'}
          >
            {getInitials()}
          </div>
          <div className="hidden sm:flex flex-col truncate max-w-[120px]">
            <span className="text-xs font-semibold text-[var(--text-main)] truncate">
              {user.name || user.preferred_username}
            </span>
          </div>
        </div>
      )}

      {onLogout && (
        <button
          type="button"
          onClick={onLogout}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-950/20 border border-red-800/40 text-red-400 hover:bg-red-900/30 text-xs font-mono transition-all duration-200 cursor-pointer"
          title={t('common.logout')}
        >
          <span className="material-symbols-outlined text-sm">logout</span>
          <span className="hidden sm:inline font-semibold">{t('common.logout')}</span>
        </button>
      )}
    </div>
  );
}
