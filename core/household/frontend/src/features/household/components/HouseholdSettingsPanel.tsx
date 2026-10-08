'use client';

import { useState } from 'react';
import { useTranslation } from '@/i18n';
import { describeApiError } from '@/lib/apiErrors';
import { Household } from '@/shared/types';
import { HouseholdPermissions } from '../permissions';
import {
  useRenameHousehold,
  useDeleteHousehold,
  useLeaveHousehold,
  useSetDefaultHousehold,
} from '../hooks/queries';
import { DeleteHouseholdModal } from './DeleteHouseholdModal';
import { StatusBanner } from './StatusBanner';
import { TransferOwnershipCard } from './TransferOwnershipCard';
import { cardClass, dangerButton, inputClass, secondaryButton } from './settingsStyles';

interface HouseholdSettingsPanelProps {
  household: Household;
  permissions: HouseholdPermissions;
  isDefault: boolean;
  /** Called after the caller left or deleted the household. */
  onRemoved: () => void;
}

type Status = { kind: 'error' | 'success'; text: string } | null;

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
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const renameMutation = useRenameHousehold(household.id);
  const deleteMutation = useDeleteHousehold(household.id);
  const leaveMutation = useLeaveHousehold(household.id);
  const defaultMutation = useSetDefaultHousehold();

  const onError = (err: unknown) => setStatus({ kind: 'error', text: describeApiError(err, t) });
  const onSuccess = (key: string) => () => setStatus({ kind: 'success', text: t(key) });

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
            <div className="flex gap-2 min-w-0">
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
                <span className="material-symbols-outlined text-sm" aria-hidden="true">star</span>
                {t('household_app.settings.is_default')}
              </p>
            ) : (
              <button type="button" onClick={handleSetDefault} disabled={defaultMutation.isPending} className={secondaryButton}>
                {t('household_app.settings.set_default')}
              </button>
            )}
          </div>
        )}

        {permissions.canTransferOwnership && <TransferOwnershipCard household={household} onStatus={setStatus} />}

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
            <div className="min-w-0">
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
