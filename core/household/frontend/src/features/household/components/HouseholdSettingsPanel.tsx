'use client';

import { useState } from 'react';
import { useTranslation } from '@/i18n';
import { describeApiError } from '@/lib/apiErrors';
import { Household, HouseholdMember } from '@/shared/types';
import { HouseholdPermissions } from '../permissions';
import {
  useRenameHousehold,
  useDeleteHousehold,
  useTransferOwnership,
  useLeaveHousehold,
  useSetDefaultHousehold,
} from '../hooks/queries';
import { DeleteHouseholdModal } from './DeleteHouseholdModal';
import { StatusBanner } from './StatusBanner';
import { memberDisplayName } from './memberDisplay';

interface HouseholdSettingsPanelProps {
  household: Household;
  permissions: HouseholdPermissions;
  isDefault: boolean;
  /** Called after the caller left or deleted the household. */
  onRemoved: () => void;
}

type Status = { kind: 'error' | 'success'; text: string } | null;

const cardClass = 'p-4 rounded-xl bg-[var(--surface-elevated)] border border-[var(--border-subtle)] space-y-3';
const inputClass =
  'w-full px-3 py-2 bg-[var(--surface-canvas)] border border-[var(--border-subtle)] rounded-lg text-xs text-[var(--text-main)] focus:outline-none focus:border-[var(--primary-main)]';
const secondaryButton =
  'px-3 py-2 rounded-lg bg-[var(--surface-canvas)] border border-[var(--border-subtle)] text-xs font-semibold text-[var(--text-main)] hover:border-[var(--primary-main)]/50 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed';
const dangerButton =
  'px-3 py-2 rounded-lg border border-red-500/40 text-xs font-semibold text-red-300 hover:bg-red-950/40 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed';

/**
 * Settings for one household: rename, default, transfer ownership, leave and
 * delete. Each action only renders when the caller's role permits it.
 */
export function HouseholdSettingsPanel({ household, permissions, isDefault, onRemoved }: HouseholdSettingsPanelProps) {
  const { t } = useTranslation();
  const [status, setStatus] = useState<Status>(null);
  // null = untouched: the input shows the current (server) name.
  const [draftName, setDraftName] = useState<string | null>(null);
  const name = draftName ?? household.name;
  const [newOwnerId, setNewOwnerId] = useState('');
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const renameMutation = useRenameHousehold(household.id);
  const deleteMutation = useDeleteHousehold(household.id);
  const transferMutation = useTransferOwnership(household.id);
  const leaveMutation = useLeaveHousehold(household.id);
  const defaultMutation = useSetDefaultHousehold();

  const onError = (err: unknown) => setStatus({ kind: 'error', text: describeApiError(err, t) });
  const onSuccess = (key: string) => () => setStatus({ kind: 'success', text: t(key) });

  const transferCandidates: HouseholdMember[] = (household.members ?? []).filter(
    (m) => m.user_id !== household.owner_id && m.role?.toUpperCase() !== 'OWNER',
  );

  const handleRename = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed || trimmed === household.name) return;
    setStatus(null);
    renameMutation.mutate(trimmed, {
      onSuccess: () => {
        setDraftName(null);
        setStatus({ kind: 'success', text: t('household_app.settings.renamed') });
      },
      onError,
    });
  };

  const handleTransfer = (e: React.FormEvent) => {
    e.preventDefault();
    const target = transferCandidates.find((m) => m.user_id === newOwnerId);
    if (!target) return;
    if (!confirm(t('household_app.settings.confirm_transfer', { name: memberDisplayName(target) }))) return;
    setStatus(null);
    transferMutation.mutate(target.user_id, {
      onSuccess: () => {
        setNewOwnerId('');
        setStatus({ kind: 'success', text: t('household_app.settings.transferred') });
      },
      onError,
    });
  };

  const handleLeave = () => {
    if (!confirm(t('household_app.settings.confirm_leave', { name: household.name }))) return;
    setStatus(null);
    leaveMutation.mutate(undefined, { onSuccess: onRemoved, onError });
  };

  const handleDelete = () => {
    setDeleteError(null);
    deleteMutation.mutate(undefined, {
      onSuccess: () => {
        setIsDeleteOpen(false);
        onRemoved();
      },
      onError: (err) => setDeleteError(describeApiError(err, t)),
    });
  };

  const handleSetDefault = () => {
    setStatus(null);
    defaultMutation.mutate(household.id, { onSuccess: onSuccess('household_app.settings.default_set'), onError });
  };

  return (
    <section
      aria-labelledby="household-settings-title"
      className="col-span-12 p-6 rounded-2xl bg-[var(--surface-card)] border border-[var(--border-subtle)] space-y-4"
    >
      <h2 id="household-settings-title" className="text-sm font-mono uppercase tracking-wide text-[var(--text-muted)] pb-3 border-b border-[var(--border-subtle)]">
        {t('household_app.settings.title')}
      </h2>

      {status && <StatusBanner kind={status.kind}>{status.text}</StatusBanner>}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {permissions.canRename && (
          <form onSubmit={handleRename} className={cardClass}>
            <label htmlFor="household-rename" className="block text-xs font-bold text-[var(--text-main)]">
              {t('household_app.settings.rename_label')}
            </label>
            <div className="flex gap-2">
              <input
                id="household-rename"
                type="text"
                value={name}
                onChange={(e) => setDraftName(e.target.value)}
                className={inputClass}
                required
              />
              <button
                type="submit"
                disabled={renameMutation.isPending || !name.trim() || name.trim() === household.name}
                className={secondaryButton}
              >
                {t('household_app.settings.rename_submit')}
              </button>
            </div>
          </form>
        )}

        {permissions.canSetDefault && (
          <div className={cardClass}>
            <div className="text-xs font-bold text-[var(--text-main)]">{t('household_app.settings.default_title')}</div>
            <p className="text-[11px] text-[var(--text-muted)]">{t('household_app.settings.default_desc')}</p>
            {isDefault ? (
              <p className="text-xs font-mono text-[var(--primary-main)] flex items-center gap-1">
                <span className="material-symbols-outlined text-sm">star</span>
                {t('household_app.settings.is_default')}
              </p>
            ) : (
              <button type="button" onClick={handleSetDefault} disabled={defaultMutation.isPending} className={secondaryButton}>
                {t('household_app.settings.set_default')}
              </button>
            )}
          </div>
        )}

        {permissions.canTransferOwnership && (
          <form onSubmit={handleTransfer} className={cardClass}>
            <div className="text-xs font-bold text-[var(--text-main)]">{t('household_app.settings.transfer_title')}</div>
            <p className="text-[11px] text-[var(--text-muted)]">{t('household_app.settings.transfer_desc')}</p>
            {transferCandidates.length > 0 ? (
              <div className="flex gap-2">
                <label htmlFor="household-transfer" className="sr-only">{t('household_app.settings.transfer_select')}</label>
                <select
                  id="household-transfer"
                  value={newOwnerId}
                  onChange={(e) => setNewOwnerId(e.target.value)}
                  className={inputClass}
                >
                  <option value="">{t('household_app.settings.transfer_placeholder')}</option>
                  {transferCandidates.map((m) => (
                    <option key={m.user_id} value={m.user_id}>{memberDisplayName(m)}</option>
                  ))}
                </select>
                <button type="submit" disabled={!newOwnerId || transferMutation.isPending} className={secondaryButton}>
                  {t('household_app.settings.transfer_submit')}
                </button>
              </div>
            ) : (
              <p className="text-[11px] font-mono text-[var(--text-muted)]">{t('household_app.settings.no_transfer_candidates')}</p>
            )}
          </form>
        )}

        <div className={cardClass}>
          <div className="text-xs font-bold text-[var(--text-main)]">{t('household_app.settings.leave_title')}</div>
          <p className="text-[11px] text-[var(--text-muted)]">
            {permissions.canLeave ? t('household_app.settings.leave_desc') : t('household_app.settings.leave_owner_hint')}
          </p>
          <button
            type="button"
            onClick={handleLeave}
            disabled={!permissions.canLeave || leaveMutation.isPending}
            className={dangerButton}
          >
            {t('household_app.settings.leave_submit')}
          </button>
        </div>
      </div>

      {permissions.canDelete && (
        <div className="p-4 rounded-xl border border-red-500/30 bg-red-950/20 space-y-2">
          <div className="text-xs font-mono uppercase tracking-wide text-red-300">{t('household_app.settings.danger_zone')}</div>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <div className="text-xs font-bold text-[var(--text-main)]">{t('household_app.settings.delete_title')}</div>
              <p className="text-[11px] text-[var(--text-muted)]">{t('household_app.settings.delete_desc')}</p>
            </div>
            <button type="button" onClick={() => setIsDeleteOpen(true)} className={dangerButton}>
              {t('household_app.settings.delete_submit')}
            </button>
          </div>
        </div>
      )}

      <DeleteHouseholdModal
        isOpen={isDeleteOpen}
        householdName={household.name}
        isPending={deleteMutation.isPending}
        error={deleteError}
        onClose={() => {
          setIsDeleteOpen(false);
          setDeleteError(null);
        }}
        onConfirm={handleDelete}
      />
    </section>
  );
}
