'use client';

import { useState, useEffect } from 'react';
import { useUserProfile, useUpdateProfile } from '@/features/profile';

/**
 * Profile Page View.
 * Binds useUserProfile() to render profile details and useUpdateProfile() to save profile updates.
 */
export default function ProfilePage() {
  const { data: profile, isLoading, isError } = useUserProfile();
  const updateMutation = useUpdateProfile();

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  useEffect(() => {
    if (profile) {
      setFirstName(profile.first_name || '');
      setLastName(profile.last_name || '');
      setAvatarUrl(profile.avatar_url || '');
    }
  }, [profile]);

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
          setStatusMessage('Profile updated successfully!');
          setTimeout(() => setStatusMessage(null), 4000);
        },
        onError: (error) => {
          setStatusMessage(`Update failed: ${error.message}`);
        },
      }
    );
  };

  if (isLoading) {
    return (
      <div className="col-span-12 p-8 rounded-2xl bg-[var(--surface-card)] border border-[var(--border-subtle)] animate-pulse space-y-4">
        <div className="h-8 w-48 bg-[var(--surface-elevated)] rounded" />
        <div className="h-32 w-full bg-[var(--surface-elevated)] rounded-xl" />
      </div>
    );
  }

  if (isError || !profile) {
    return (
      <div className="col-span-12 p-6 rounded-2xl bg-red-950/20 border border-red-800/40 text-red-300 text-sm font-mono">
        Error loading profile. Ensure backend service is reachable.
      </div>
    );
  }

  return (
    <>
      {/* Header Banner */}
      <div className="col-span-12 p-6 rounded-2xl bg-[var(--surface-card)] border border-[var(--border-subtle)] flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-full bg-gradient-to-tr from-[var(--surface-elevated)] to-[var(--primary-main)]/30 border-2 border-[var(--primary-main)] flex items-center justify-center text-xl font-bold text-[var(--primary-main)] overflow-hidden">
            {profile.avatar_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={profile.avatar_url}
                alt={`${profile.first_name} ${profile.last_name}`}
                className="w-full h-full object-cover"
              />
            ) : (
              `${profile.first_name?.[0] || 'U'}${profile.last_name?.[0] || ''}`
            )}
          </div>
          <div>
            <h1 className="text-xl font-bold text-[var(--text-main)]">
              {profile.first_name} {profile.last_name}
            </h1>
            <p className="text-xs font-mono text-[var(--text-muted)] mt-0.5">
              @{profile.username} • {profile.email}
            </p>
          </div>
        </div>

        <div className="hidden sm:block text-right">
          <span className="px-2.5 py-1 rounded bg-[var(--primary-main)]/10 text-[var(--primary-main)] border border-[var(--primary-main)]/30 text-xs font-mono">
            ID: {profile.id}
          </span>
        </div>
      </div>

      {/* Edit Form */}
      <div className="col-span-12 md:col-span-8 p-6 rounded-2xl bg-[var(--surface-card)] border border-[var(--border-subtle)]">
        <h2 className="text-lg font-bold text-[var(--text-main)] mb-1">
          Edit Profile Information
        </h2>
        <p className="text-xs text-[var(--text-muted)] mb-6">
          Update your public name and avatar URL across the platform.
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
                First Name
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
                Last Name
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
              Avatar Image URL
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
              {updateMutation.isPending ? 'Saving...' : 'Save Profile Changes'}
            </button>
          </div>
        </form>
      </div>

      {/* Profile Metadata Sidebar */}
      <div className="col-span-12 md:col-span-4 p-6 rounded-2xl bg-[var(--surface-card)] border border-[var(--border-subtle)]">
        <h2 className="text-base font-bold text-[var(--text-main)] mb-4">Account Metadata</h2>
        <div className="space-y-3.5 text-xs">
          <div>
            <span className="block text-[var(--text-muted)] font-mono text-[10px] uppercase">Username</span>
            <span className="font-semibold text-[var(--text-main)]">@{profile.username}</span>
          </div>
          <div>
            <span className="block text-[var(--text-muted)] font-mono text-[10px] uppercase">Email Binding</span>
            <span className="font-semibold text-[var(--text-main)]">{profile.email}</span>
          </div>
          <div>
            <span className="block text-[var(--text-muted)] font-mono text-[10px] uppercase">Created At</span>
            <span className="font-mono text-[var(--text-main)]">
              {new Date(profile.created_at).toLocaleDateString()}
            </span>
          </div>
          <div>
            <span className="block text-[var(--text-muted)] font-mono text-[10px] uppercase">Last Updated</span>
            <span className="font-mono text-[var(--text-main)]">
              {new Date(profile.updated_at).toLocaleString()}
            </span>
          </div>
        </div>
      </div>
    </>
  );
}
