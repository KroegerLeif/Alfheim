'use client';

import { useState, useEffect } from 'react';
import { useTranslation } from '@loeger-os/shared';
import { useHouseholds, useCreateHousehold, useCreateInvite, useJoinHousehold } from '@/features/household';
import { QRCodeModal } from '@/features/household/components/QRCodeModal';
import { InviteCodeResponse, HouseholdMember } from '@/shared/types';

/**
 * Household Management Page View.
 * Displays dynamic household environments, member registry with Keycloak identity sync, and invite/create workflows.
 */
export default function HouseholdPage() {
  const { t } = useTranslation();
  const { data: households, isLoading, isError } = useHouseholds();
  const createHouseholdMutation = useCreateHousehold();
  const createInviteMutation = useCreateInvite();
  const joinMutation = useJoinHousehold();

  const [selectedHouseholdId, setSelectedHouseholdId] = useState<string | null>(null);
  const [activeInvite, setActiveInvite] = useState<InviteCodeResponse | null>(null);
  const [joinTokenInput, setJoinTokenInput] = useState('');
  const [joinStatus, setJoinStatus] = useState<string | null>(null);

  // Create Household Modal state
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [newHouseholdName, setNewHouseholdName] = useState('');
  const [createStatus, setCreateStatus] = useState<string | null>(null);

  const handleHouseholdSelect = (id: string) => {
    setSelectedHouseholdId(id);
    localStorage.setItem('loeger_os_active_household_id', id);
    window.dispatchEvent(new Event('storage-household-changed'));
  };

  useEffect(() => {
    if (households && households.length > 0) {
      const saved = localStorage.getItem('loeger_os_active_household_id');
      const exists = households.some((h) => h.id === saved);
      if (saved && exists) {
        setSelectedHouseholdId(saved);
      } else {
        const defaultHh = households[0];
        handleHouseholdSelect(defaultHh.id);
      }
    }
  }, [households]);

  const activeHousehold = households && households.length > 0
    ? households.find((h) => h.id === selectedHouseholdId) || households[0]
    : null;

  const handleGenerateInvite = () => {
    if (!activeHousehold) return;

    createInviteMutation.mutate(
      {
        household_id: activeHousehold.id,
        role: 'member',
        ttl_minutes: 60,
        max_uses: 5,
      },
      {
        onSuccess: (data) => {
          setActiveInvite(data);
        },
      }
    );
  };

  const handleCreateHouseholdSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newHouseholdName.trim()) return;
    setCreateStatus(null);

    createHouseholdMutation.mutate(
      { name: newHouseholdName.trim() },
      {
        onSuccess: (newHh) => {
          setNewHouseholdName('');
          setIsCreateModalOpen(false);
          if (newHh?.id) {
            handleHouseholdSelect(newHh.id);
          }
        },
        onError: (err) => {
          setCreateStatus(t('household.create_failed', { error: err.message }));
        },
      }
    );
  };

  const handleJoinSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!joinTokenInput.trim()) return;
    setJoinStatus(null);

    joinMutation.mutate(
      { token: joinTokenInput.trim() },
      {
        onSuccess: (household) => {
          setJoinStatus(t('household.join_success', { name: household.name }));
          setJoinTokenInput('');
          if (household?.id) {
            handleHouseholdSelect(household.id);
          }
        },
        onError: (err) => {
          setJoinStatus(t('household.join_failed', { error: err.message }));
        },
      }
    );
  };

  if (isLoading) {
    return (
      <div className="col-span-12 p-8 rounded-2xl bg-[var(--surface-card)] border border-[var(--border-subtle)] animate-pulse space-y-4">
        <div className="h-8 w-64 bg-[var(--surface-elevated)] rounded" />
        <div className="h-40 w-full bg-[var(--surface-elevated)] rounded-xl" />
      </div>
    );
  }

  const getMemberDisplayName = (m: HouseholdMember) => {
    if (m.first_name || m.last_name) {
      return `${m.first_name || ''} ${m.last_name || ''}`.trim();
    }
    if (m.username) return `@${m.username}`;
    if (m.email) return m.email;
    if (m.user_id) {
      return `User (${m.user_id.length > 8 ? `${m.user_id.substring(0, 8)}...` : m.user_id})`;
    }
    return t('household.member_user');
  };

  const getMemberInitials = (m: HouseholdMember) => {
    if (m.first_name && m.last_name) {
      return `${m.first_name[0]}${m.last_name[0]}`.toUpperCase();
    }
    if (m.username) return m.username.substring(0, 2).toUpperCase();
    if (m.email) return m.email.substring(0, 2).toUpperCase();
    return m.user_id ? m.user_id.substring(0, 2).toUpperCase() : 'MU';
  };

  return (
    <>
      {isError || !households || households.length === 0 || !activeHousehold ? (
        /* Zero Household Empty State */
        <div className="col-span-12 min-h-[65vh] flex flex-col items-center justify-center p-8 rounded-2xl bg-[var(--surface-card)] border border-[var(--border-subtle)] relative overflow-hidden shadow-2xl">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-[var(--primary-main)]/5 rounded-full blur-3xl pointer-events-none" />

          <div className="w-16 h-16 rounded-2xl bg-[var(--primary-main)]/10 border border-[var(--border-accent)] flex items-center justify-center text-[var(--primary-main)] mb-4 shadow-[0_0_20px_var(--accent-glow)]">
            <span className="material-symbols-outlined text-3xl">home_app_logo</span>
          </div>

          <h1 className="text-2xl font-bold text-[var(--text-main)] mb-2">{t('household.no_household')}</h1>
          <p className="text-xs text-[var(--text-muted)] max-w-md text-center mb-8 leading-relaxed font-sans">
            {t('household.no_household_desc')}
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 w-full max-w-xl">
            {/* Create Household Card */}
            <div className="p-5 rounded-xl bg-[var(--surface-canvas)] border border-[var(--border-subtle)] flex flex-col justify-between space-y-4">
              <div>
                <div className="flex items-center gap-2 text-sm font-bold text-[var(--text-main)] mb-1">
                  <span className="material-symbols-outlined text-[var(--primary-main)]">add_home</span>
                  <span>{t('household.create_household')}</span>
                </div>
                <p className="text-xs text-[var(--text-muted)]">
                  {t('household.create_household_desc')}
                </p>
              </div>
              <button
                onClick={() => setIsCreateModalOpen(true)}
                className="w-full py-2.5 rounded-lg bg-[var(--primary-main)] text-slate-950 font-bold text-xs hover:bg-[var(--primary-hover)] transition-all cursor-pointer shadow-md"
              >
                {t('household.create_household')}
              </button>
            </div>

            {/* Join Household Card */}
            <div className="p-5 rounded-xl bg-[var(--surface-canvas)] border border-[var(--border-subtle)] flex flex-col justify-between space-y-4">
              <div>
                <div className="flex items-center gap-2 text-sm font-bold text-[var(--text-main)] mb-1">
                  <span className="material-symbols-outlined text-[var(--primary-main)]">qr_code_scanner</span>
                  <span>{t('household.join_household')}</span>
                </div>
                <p className="text-xs text-[var(--text-muted)]">
                  {t('household.join_household_desc')}
                </p>
              </div>

              <form onSubmit={handleJoinSubmit} className="space-y-2">
                <input
                  type="text"
                  placeholder={t('household.invite_token_placeholder')}
                  value={joinTokenInput}
                  onChange={(e) => setJoinTokenInput(e.target.value)}
                  className="w-full px-3 py-2 bg-[var(--surface-card)] border border-[var(--border-subtle)] rounded-lg text-xs font-mono text-[var(--text-main)] focus:outline-none focus:border-[var(--primary-main)]"
                  required
                />
                <button
                  type="submit"
                  disabled={joinMutation.isPending}
                  className="w-full py-2 rounded-lg bg-[var(--surface-elevated)] border border-[var(--border-subtle)] hover:border-[var(--primary-main)]/50 text-xs font-semibold text-[var(--text-main)] transition-all cursor-pointer disabled:opacity-50"
                >
                  {joinMutation.isPending ? t('household.joining') : t('household.submit_token')}
                </button>
              </form>
            </div>
          </div>
        </div>
      ) : (
        /* Active Household Layout */
        <>
          {/* Household Header */}
          <div className="col-span-12 p-6 rounded-2xl bg-[var(--surface-card)] border border-[var(--border-subtle)] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-[var(--primary-main)]/10 text-[var(--primary-main)] text-xs font-mono border border-[var(--border-accent)]">
                  <span className="material-symbols-outlined text-sm">home</span>
                  {t('household.title')}
                </div>

                {/* Multiple Household Switcher */}
                {households.length > 1 && (
                  <select
                    value={activeHousehold.id}
                    onChange={(e) => handleHouseholdSelect(e.target.value)}
                    className="px-2.5 py-1 rounded-lg bg-[var(--surface-canvas)] border border-[var(--border-subtle)] text-xs font-mono text-[var(--text-main)] cursor-pointer"
                  >
                    {households.map((h) => (
                      <option key={h.id} value={h.id}>
                        {h.name}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              <h1 className="text-2xl font-bold text-[var(--text-main)]">
                {activeHousehold.name}
              </h1>
              <p className="text-xs font-mono text-[var(--text-muted)] mt-1">
                Slug: {activeHousehold.slug} • {t('common.role')}: {activeHousehold.role || 'Member'}
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setIsCreateModalOpen(true)}
                className="px-3.5 py-2 rounded-lg bg-[var(--surface-canvas)] border border-[var(--border-subtle)] hover:border-[var(--primary-main)]/50 text-[var(--text-main)] font-mono text-xs flex items-center gap-1.5 cursor-pointer transition-all duration-150"
              >
                <span className="material-symbols-outlined text-sm">add_home</span>
                <span>{t('household.create_household')}</span>
              </button>

              <button
                onClick={handleGenerateInvite}
                disabled={createInviteMutation.isPending}
                className="px-4 py-2 rounded-lg bg-[var(--primary-main)] text-slate-950 font-bold text-xs hover:bg-[var(--primary-hover)] transition-all duration-200 shadow-[0_0_15px_var(--accent-glow)] cursor-pointer flex items-center gap-2 disabled:opacity-50"
              >
                <span className="material-symbols-outlined text-base">qr_code_2</span>
                {createInviteMutation.isPending ? t('common.loading') : t('household.generate_invite')}
              </button>
            </div>
          </div>

          {/* QR Code Modal Popup */}
          {activeInvite && (
            <QRCodeModal invite={activeInvite} onClose={() => setActiveInvite(null)} />
          )}

          {/* Members List Section */}
          <div className="col-span-12 md:col-span-8 p-6 rounded-2xl bg-[var(--surface-card)] border border-[var(--border-subtle)]">
            <div className="flex items-center justify-between mb-4 pb-3 border-b border-[var(--border-subtle)]">
              <h2 className="text-base font-bold text-[var(--text-main)]">{t('household.registry_and_members')}</h2>
              <span className="text-xs font-mono text-[var(--text-muted)]">
                {t('household.enrolled_count', { count: activeHousehold.members?.length || 0 })}
              </span>
            </div>

            <div className="space-y-3">
              {activeHousehold.members && activeHousehold.members.length > 0 ? (
                activeHousehold.members.map((member) => (
                  <div
                    key={member.user_id}
                    className="p-3.5 rounded-xl bg-[var(--surface-elevated)] border border-[var(--border-subtle)] flex items-center justify-between text-xs hover:border-[var(--border-accent)] transition-colors duration-150"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-full bg-[var(--surface-canvas)] border border-[var(--border-subtle)] flex items-center justify-center font-mono font-bold text-[var(--primary-main)] shrink-0 overflow-hidden">
                        {member.avatar_url ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={member.avatar_url} alt={getMemberDisplayName(member)} className="w-full h-full object-cover" />
                        ) : (
                          getMemberInitials(member)
                        )}
                      </div>
                      <div>
                        <div className="font-semibold text-[var(--text-main)]">
                          {getMemberDisplayName(member)}
                        </div>
                        <div className="text-[var(--text-muted)] text-[10px] font-mono">
                          {member.email ? `${member.email} • ` : ''}{t('household.joined_date', { date: new Date(member.joined_at).toLocaleDateString() })}
                        </div>
                      </div>
                    </div>

                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold uppercase bg-[var(--surface-canvas)] text-[var(--primary-main)] border border-[var(--border-subtle)]">
                      {member.role}
                    </span>
                  </div>
                ))
              ) : (
                <div className="p-8 text-center text-xs text-[var(--text-muted)] font-mono bg-[var(--surface-elevated)] border border-dashed border-[var(--border-subtle)] rounded-xl">
                  No members enrolled in this household.
                </div>
              )}
            </div>
          </div>

          {/* Join Another Household Form */}
          <div className="col-span-12 md:col-span-4 p-6 rounded-2xl bg-[var(--surface-card)] border border-[var(--border-subtle)] flex flex-col justify-between">
            <div>
              <h2 className="text-base font-bold text-[var(--text-main)] mb-1">
                {t('household.join_household')}
              </h2>
              <p className="text-xs text-[var(--text-muted)] mb-4">
                {t('household.join_household_desc')}
              </p>

              {joinStatus && (
                <div
                  className={`p-3 mb-4 rounded-lg text-xs font-mono ${
                    joinMutation.isError
                      ? 'bg-red-950/40 border border-red-800/40 text-red-300'
                      : 'bg-emerald-950/40 border border-emerald-800/40 text-emerald-300'
                  }`}
                >
                  {joinStatus}
                </div>
              )}

              <form onSubmit={handleJoinSubmit} className="space-y-3">
                <div>
                  <label className="block text-[10px] font-mono uppercase text-[var(--text-muted)] mb-1.5">
                    {t('household.invite_code_token')}
                  </label>
                  <input
                    type="text"
                    placeholder={t('household.invite_token_placeholder')}
                    value={joinTokenInput}
                    onChange={(e) => setJoinTokenInput(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-[var(--surface-canvas)] border border-[var(--border-subtle)] rounded-lg text-xs font-mono text-[var(--text-main)] focus:outline-none focus:border-[var(--primary-main)]"
                    required
                  />
                </div>

                <button
                  type="submit"
                  disabled={joinMutation.isPending}
                  className="w-full py-2.5 rounded-lg bg-[var(--surface-elevated)] hover:bg-[var(--surface-canvas)] border border-[var(--border-subtle)] hover:border-[var(--primary-main)]/50 text-xs font-semibold text-[var(--text-main)] transition-all cursor-pointer disabled:opacity-50"
                >
                  {joinMutation.isPending ? t('household.joining') : t('household.submit_token')}
                </button>
              </form>
            </div>

            <div className="mt-6 pt-4 border-t border-[var(--border-subtle)] text-[10px] font-mono text-[var(--text-muted)]">
              {t('household.household_security_note')}
            </div>
          </div>
        </>
      )}

      {/* Consolidated Create Household Modal */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[var(--surface-card)] border border-[var(--border-subtle)] rounded-2xl w-full max-w-md p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-[var(--border-subtle)]">
              <h3 className="text-base font-bold text-[var(--text-main)]">{t('household.create_household')}</h3>
              <button onClick={() => setIsCreateModalOpen(false)} className="text-[var(--text-muted)] hover:text-[var(--text-main)] cursor-pointer">
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            {createStatus && (
              <div className="p-3 rounded bg-red-950/40 border border-red-800/40 text-red-300 text-xs font-mono">
                {createStatus}
              </div>
            )}

            <form onSubmit={handleCreateHouseholdSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-mono uppercase text-[var(--text-muted)] mb-1">
                  {t('household.title')} {t('catalog.app_name')} *
                </label>
                <input
                  type="text"
                  value={newHouseholdName}
                  onChange={(e) => setNewHouseholdName(e.target.value)}
                  placeholder="e.g. Residence"
                  className="w-full px-3.5 py-2 bg-[var(--surface-canvas)] border border-[var(--border-subtle)] rounded-lg text-xs text-[var(--text-main)] focus:outline-none focus:border-[var(--primary-main)]"
                  required
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(false)}
                  className="px-4 py-2 rounded bg-[var(--surface-canvas)] border border-[var(--border-subtle)] text-xs font-mono text-[var(--text-muted)] cursor-pointer"
                >
                  {t('common.cancel')}
                </button>
                <button
                  type="submit"
                  disabled={createHouseholdMutation.isPending}
                  className="px-4 py-2 rounded bg-[var(--primary-main)] text-slate-950 font-bold text-xs hover:bg-[var(--primary-hover)] cursor-pointer disabled:opacity-50"
                >
                  {createHouseholdMutation.isPending ? t('common.loading') : t('household.create_household')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}

