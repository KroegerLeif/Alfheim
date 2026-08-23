'use client';

import { useTranslation } from '@alfheim/shared';

interface ProfileHeaderBannerProps {
  displayName: string;
  username: string;
  email: string;
  userId: string;
  firstName: string;
  lastName: string;
  avatarUrl: string;
  profileAvatarUrl?: string;
  logout: () => void;
}

export function ProfileHeaderBanner({
  displayName,
  username,
  email,
  userId,
  firstName,
  lastName,
  avatarUrl,
  profileAvatarUrl,
  logout,
}: ProfileHeaderBannerProps) {
  const { t } = useTranslation();

  return (
    <div className="col-span-12 p-6 rounded-2xl bg-[var(--surface-card)] border border-[var(--border-subtle)] flex items-center justify-between">
      <div className="flex items-center gap-4">
        <div className="w-16 h-16 rounded-full bg-gradient-to-tr from-[var(--surface-elevated)] to-[var(--primary-main)]/30 border-2 border-[var(--primary-main)] flex items-center justify-center text-xl font-bold text-[var(--primary-main)] overflow-hidden font-mono">
          {profileAvatarUrl || avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={profileAvatarUrl || avatarUrl}
              alt={displayName}
              className="w-full h-full object-cover"
            />
          ) : (
            `${(firstName?.[0] || displayName[0] || 'U').toUpperCase()}${(lastName?.[0] || '').toUpperCase()}`
          )}
        </div>
        <div>
          <h1 className="text-xl font-bold text-[var(--text-main)]">
            {displayName}
          </h1>
          <p className="text-xs font-mono text-[var(--text-muted)] mt-0.5">
            @{username} • {email}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <div className="hidden sm:block text-right">
          <span className="px-2.5 py-1 rounded bg-[var(--primary-main)]/10 text-[var(--primary-main)] border border-[var(--primary-main)]/30 text-xs font-mono">
            Keycloak ID: {userId}
          </span>
        </div>

        <button
          onClick={logout}
          type="button"
          className="px-3.5 py-1.5 rounded-lg bg-red-950/30 border border-red-800/40 text-red-400 hover:bg-red-900/40 text-xs font-mono flex items-center gap-1.5 transition-all duration-200 cursor-pointer"
        >
          <span className="material-symbols-outlined text-sm">logout</span>
          <span>{t('common.logout')}</span>
        </button>
      </div>
    </div>
  );
}
