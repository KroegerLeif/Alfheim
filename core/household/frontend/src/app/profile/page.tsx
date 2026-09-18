'use client';

import { useState, useEffect } from 'react';
import { useTranslation } from '@alfheim/shared';
import { useUserProfile, useUpdateProfile, ProfileHeaderBanner, ProfileOidcClaims } from '@/features/profile';
import { useAuth } from '@/core/providers';

export default function ProfilePage() {
  const { t } = useTranslation();
  const { user: authUser, logout } = useAuth();
  const { data: profile } = useUserProfile();
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
      <ProfileHeaderBanner
        displayName={displayName}
        username={username}
        email={email}
        userId={userId}
        firstName={firstName}
        lastName={lastName}
        avatarUrl={avatarUrl}
        profileAvatarUrl={profile?.avatar_url}
        logout={logout}
      />

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
              placeholder={t('profile.avatar_url_placeholder')}
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

      <ProfileOidcClaims
        authUser={authUser}
        userId={userId}
        username={username}
        email={email}
        firstName={firstName}
        lastName={lastName}
      />
    </>
  );
}
