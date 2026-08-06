'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslation } from '@loeger-os/shared';
import { useHouseholds, useCreateHousehold, useJoinHousehold } from '@/features/household';

export default function HouseholdSelectorPage() {
  const { t } = useTranslation();
  const router = useRouter();
  const { data: households, isLoading, isError } = useHouseholds();
  const createHouseholdMutation = useCreateHousehold();
  const joinMutation = useJoinHousehold();

  const [joinTokenInput, setJoinTokenInput] = useState('');
  const [joinStatus, setJoinStatus] = useState<string | null>(null);

  // Create Household Modal state
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [newHouseholdName, setNewHouseholdName] = useState('');
  const [createStatus, setCreateStatus] = useState<string | null>(null);

  const handleHouseholdSelect = (id: string, role: string) => {
    localStorage.setItem('loeger_os_active_household_id', id);
    localStorage.setItem('loeger_os_active_household_role', role);
    window.dispatchEvent(new Event('storage-household-changed'));
    router.push(`/household/${id}`);
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
            handleHouseholdSelect(newHh.id, 'OWNER');
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
            handleHouseholdSelect(household.id, household.role || 'MEMBER');
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
      <div className="col-span-12 min-h-[60vh] flex flex-col items-center justify-center p-8 rounded-2xl bg-[var(--surface-card)] border border-[var(--border-subtle)] animate-pulse space-y-4">
        <div className="h-8 w-64 bg-[var(--surface-elevated)] rounded" />
        <div className="h-40 w-full max-w-2xl bg-[var(--surface-elevated)] rounded-xl" />
      </div>
    );
  }

  const hasHouseholds = households && households.length > 0;

  return (
    <>
      <div className="col-span-12 max-w-4xl mx-auto w-full space-y-8 py-4 sm:py-8">
        {/* Title Header */}
        <div className="flex flex-col space-y-2">
          <div className="inline-flex items-center gap-2 self-start px-2.5 py-1 rounded-full bg-[var(--primary-main)]/10 text-[var(--primary-main)] text-xs font-mono border border-[var(--border-accent)]">
            <span className="material-symbols-outlined text-sm">home</span>
            {t('household.title')}
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight text-[var(--text-main)]">
            {hasHouseholds ? t('household.select_household') : t('household.no_household')}
          </h1>
          <p className="text-sm text-[var(--text-muted)] font-sans max-w-xl">
            {hasHouseholds
              ? t('household.select_household_desc')
              : t('household.no_household_desc')}
          </p>
        </div>

        {joinStatus && (
          <div className={`p-4 rounded-xl text-xs font-mono border ${
            joinStatus.includes('failed')
              ? 'bg-red-950/40 border-red-800/40 text-red-300'
              : 'bg-emerald-950/40 border-emerald-800/40 text-emerald-300'
          }`}>
            {joinStatus}
          </div>
        )}

        {hasHouseholds ? (
          /* Selector List / Grid view */
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {households.map((hh) => (
              <div
                key={hh.id}
                onClick={() => handleHouseholdSelect(hh.id, hh.role || 'MEMBER')}
                className="group p-6 rounded-2xl bg-[var(--surface-card)] border border-[var(--border-subtle)] hover:border-[var(--primary-main)]/50 transition-all duration-200 cursor-pointer flex flex-col justify-between space-y-6 shadow-md hover:shadow-xl relative overflow-hidden"
              >
                <div className="absolute top-0 right-0 w-24 h-24 bg-[var(--primary-main)]/5 rounded-full blur-2xl pointer-events-none group-hover:bg-[var(--primary-main)]/10 transition-colors" />
                <div className="space-y-3">
                  <div className="flex justify-between items-start">
                    <div className="w-10 h-10 rounded-xl bg-[var(--primary-main)]/10 border border-[var(--border-accent)] flex items-center justify-center text-[var(--primary-main)]">
                      <span className="material-symbols-outlined text-lg">house</span>
                    </div>
                    <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase bg-[var(--surface-canvas)] text-[var(--primary-main)] border border-[var(--border-subtle)]">
                      {hh.role || 'MEMBER'}
                    </span>
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-[var(--text-main)] group-hover:text-[var(--primary-main)] transition-colors">
                      {hh.name}
                    </h3>
                    <p className="text-xs text-[var(--text-muted)] mt-1 font-sans">
                      {hh.street ? `${hh.street}, ${hh.zip} ${hh.city}` : t('household.no_address')}
                    </p>
                  </div>
                </div>
                <div className="pt-4 border-t border-[var(--border-subtle)] flex items-center justify-between text-xs text-[var(--primary-main)] font-semibold">
                  <span>{t('common.launch')}</span>
                  <span className="material-symbols-outlined text-sm group-hover:translate-x-1 transition-transform">arrow_forward</span>
                </div>
              </div>
            ))}
          </div>
        ) : null}

        {/* Action Cards (Create & Join) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          {/* Create Household Card */}
          <div className="p-6 rounded-2xl bg-[var(--surface-card)] border border-[var(--border-subtle)] flex flex-col justify-between space-y-4 shadow-lg">
            <div>
              <div className="flex items-center gap-2 text-sm font-bold text-[var(--text-main)] mb-1">
                <span className="material-symbols-outlined text-[var(--primary-main)]">add_home</span>
                <span>{t('household.create_household')}</span>
              </div>
              <p className="text-xs text-[var(--text-muted)] leading-relaxed font-sans">
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
          <div className="p-6 rounded-2xl bg-[var(--surface-card)] border border-[var(--border-subtle)] flex flex-col justify-between space-y-4 shadow-lg">
            <div>
              <div className="flex items-center gap-2 text-sm font-bold text-[var(--text-main)] mb-1">
                <span className="material-symbols-outlined text-[var(--primary-main)]">qr_code_scanner</span>
                <span>{t('household.join_household')}</span>
              </div>
              <p className="text-xs text-[var(--text-muted)] leading-relaxed font-sans">
                {t('household.join_household_desc')}
              </p>
            </div>

            <form onSubmit={handleJoinSubmit} className="space-y-2">
              <input
                type="text"
                placeholder={t('household.invite_token_placeholder')}
                value={joinTokenInput}
                onChange={(e) => setJoinTokenInput(e.target.value)}
                className="w-full px-3 py-2 bg-[var(--surface-canvas)] border border-[var(--border-subtle)] rounded-lg text-xs font-mono text-[var(--text-main)] focus:outline-none focus:border-[var(--primary-main)]"
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
