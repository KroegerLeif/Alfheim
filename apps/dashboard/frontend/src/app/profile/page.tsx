'use client';

import { useState, useEffect } from 'react';
import { useTranslation } from '@loeger-os/shared';
import { useUserProfile, useUpdateProfile } from '@/features/profile';
import { useAuth } from '@/shared/providers/AuthProvider';

/**
 * Profile Page View.
 * Binds OIDC JWT user identity claims from useAuth() and syncs profile updates via useUserProfile()/useUpdateProfile().
 */
export default function ProfilePage() {
  const { t } = useTranslation();
  const { user: authUser, logout } = useAuth();
  const { data: profile, isLoading, isError } = useUserProfile();
  const updateMutation = useUpdateProfile();

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  useEffect(() => {
    if (profile) {
      setFirstName(profile.first_name || authUser?.given_name || '');
      setLastName(profile.last_name || authUser?.family_name || '');
      setAvatarUrl(profile.avatar_url || '');
    } else if (authUser) {
      setFirstName(authUser.given_name || '');
      setLastName(authUser.family_name || '');
    }
  }, [profile, authUser]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setStatusMessage(null);

    updateMutation.mutate(
      {
        first_name: firstName,
        last_name: lastName,
        avatar_url: avatarUrl,
      },
      {
        onSuccess: () => {
          setStatusMessage(t('common.save_changes'));
          setTimeout(() => setStatusMessage(null), 4000);
        },
        onError: (error) => {
          setStatusMessage(`Update failed: ${error.message}`);
        },
      }
    );
  };

  const displayName = profile
    ? `${profile.first_name} ${profile.last_name}`
    : authUser?.name || t('dashboard.authenticated_user');

  const username = profile?.username || authUser?.preferred_username || 'user';
  const email = profile?.email || authUser?.email || '';
  const userId = profile?.id || authUser?.sub || t('profile.not_available');

  return (
    <>
      {/* Header Banner */}
      <div className="col-span-12 p-6 rounded-2xl bg-[var(--surface-card)] border border-[var(--border-subtle)] flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-full bg-gradient-to-tr from-[var(--surface-elevated)] to-[var(--primary-main)]/30 border-2 border-[var(--primary-main)] flex items-center justify-center text-xl font-bold text-[var(--primary-main)] overflow-hidden font-mono">
            {profile?.avatar_url || avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={profile?.avatar_url || avatarUrl}
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

      {/* Edit Form */}
      <div className="col-span-12 md:col-span-8 p-6 rounded-2xl bg-[var(--surface-card)] border border-[var(--border-subtle)]">
        <h2 className="text-lg font-bold text-[var(--text-main)] mb-1">
          {t('profile.title')}
        </h2>
        <p className="text-xs text-[var(--text-muted)] mb-6">
          {t('profile.user_details')}
        </p>

        {statusMessage && (
          <div
            className={`p-3.5 mb-6 rounded-lg text-xs font-mono ${
              updateMutation.isError
                ? 'bg-red-950/40 border border-red-800/40 text-red-300'
                : 'bg-emerald-950/40 border border-emerald-800/40 text-emerald-300'
            }`}
          >
            {statusMessage}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-mono uppercase text-[var(--text-muted)] mb-2">
                {t('profile.first_name')}
              </label>
              <input
                type="text"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-[var(--surface-canvas)] border border-[var(--border-subtle)] rounded-lg text-sm text-[var(--text-main)] focus:outline-none focus:border-[var(--primary-main)] transition-colors duration-200"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-mono uppercase text-[var(--text-muted)] mb-2">
                {t('profile.last_name')}
              </label>
              <input
                type="text"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-[var(--surface-canvas)] border border-[var(--border-subtle)] rounded-lg text-sm text-[var(--text-main)] focus:outline-none focus:border-[var(--primary-main)] transition-colors duration-200"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-mono uppercase text-[var(--text-muted)] mb-2">
              {t('profile.avatar_url')}
            </label>
            <input
              type="url"
              value={avatarUrl}
              onChange={(e) => setAvatarUrl(e.target.value)}
              placeholder="https://example.com/avatar.jpg"
              className="w-full px-3.5 py-2.5 bg-[var(--surface-canvas)] border border-[var(--border-subtle)] rounded-lg text-sm text-[var(--text-main)] focus:outline-none focus:border-[var(--primary-main)] transition-colors duration-200 font-mono text-xs"
            />
          </div>

          <div className="pt-3 border-t border-[var(--border-subtle)] flex items-center justify-end">
            <button
              type="submit"
              disabled={updateMutation.isPending}
              className="px-5 py-2.5 rounded-lg bg-[var(--primary-main)] text-slate-950 font-semibold text-xs hover:bg-[var(--primary-hover)] transition-all duration-200 cursor-pointer disabled:opacity-50"
            >
              {updateMutation.isPending ? t('common.loading') : t('common.save_changes')}
            </button>
          </div>
        </form>
      </div>

      {/* Profile Metadata Sidebar */}
      <div className="col-span-12 md:col-span-4 p-6 rounded-2xl bg-[var(--surface-card)] border border-[var(--border-subtle)]">
        <h2 className="text-base font-bold text-[var(--text-main)] mb-4">{t('profile.oidc_claims_title')}</h2>
        <div className="space-y-3.5 text-xs">
          <div>
            <span className="block text-[var(--text-muted)] font-mono text-[10px] uppercase">{t('profile.subject_sub')}</span>
            <span className="font-mono text-[var(--text-main)] break-all">{authUser?.sub || userId}</span>
          </div>
          <div>
            <span className="block text-[var(--text-muted)] font-mono text-[10px] uppercase">{t('profile.username')}</span>
            <span className="font-semibold text-[var(--text-main)]">@{username}</span>
          </div>
          <div>
            <span className="block text-[var(--text-muted)] font-mono text-[10px] uppercase">{t('profile.email')}</span>
            <span className="font-semibold text-[var(--text-main)]">{email || t('profile.not_available')}</span>
          </div>
          <div>
            <span className="block text-[var(--text-muted)] font-mono text-[10px] uppercase">{t('profile.given_name')}</span>
            <span className="font-mono text-[var(--text-main)]">{authUser?.given_name || firstName || t('profile.not_available')}</span>
          </div>
          <div>
            <span className="block text-[var(--text-muted)] font-mono text-[10px] uppercase">{t('profile.family_name')}</span>
            <span className="font-mono text-[var(--text-main)]">{authUser?.family_name || lastName || t('profile.not_available')}</span>
          </div>
        </div>
      </div>
    </>
  );
}
