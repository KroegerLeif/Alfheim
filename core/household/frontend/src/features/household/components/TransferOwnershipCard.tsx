'use client';

import { useState } from 'react';
import { useTranslation } from '@/i18n';
import { describeApiError } from '@/lib/apiErrors';
import { Household, HouseholdMember } from '@/shared/types';
import { useTransferOwnership } from '../hooks/queries';
import { memberDisplayName } from './memberDisplay';
import { cardClass, inputClass, secondaryButton } from './settingsStyles';

interface TransferOwnershipCardProps {
  household: Household;
  onStatus: (status: { kind: 'error' | 'success'; text: string } | null) => void;
}

/** OWNER-only card that hands the owner role to another member. */
export function TransferOwnershipCard({ household, onStatus }: TransferOwnershipCardProps) {
  const { t } = useTranslation();
  const [newOwnerId, setNewOwnerId] = useState('');
  const transferMutation = useTransferOwnership(household.id);

  const candidates: HouseholdMember[] = (household.members ?? []).filter(
    (m) => m.user_id !== household.owner_id && m.role?.toUpperCase() !== 'OWNER',
  );

  const handleTransfer = (e: React.FormEvent) => {
    e.preventDefault();
    const target = candidates.find((m) => m.user_id === newOwnerId);
    if (!target) return;
    if (!confirm(t('household_app.settings.confirm_transfer', { name: memberDisplayName(target, t) }))) return;
    onStatus(null);
    transferMutation.mutate(target.user_id, {
      onSuccess: () => {
        setNewOwnerId('');
        onStatus({ kind: 'success', text: t('household_app.settings.transferred') });
      },
      onError: (err) => onStatus({ kind: 'error', text: describeApiError(err, t) }),
    });
  };

  return (
    <form onSubmit={handleTransfer} className={cardClass}>
      <div className="text-xs font-bold text-[var(--text-main)]">{t('household_app.settings.transfer_title')}</div>
      <p className="text-[11px] text-[var(--text-muted)]">{t('household_app.settings.transfer_desc')}</p>
      {candidates.length > 0 ? (
        <div className="flex gap-2 min-w-0">
          <label htmlFor="household-transfer" className="sr-only">{t('household_app.settings.transfer_select')}</label>
          <select
            id="household-transfer"
            value={newOwnerId}
            onChange={(e) => setNewOwnerId(e.target.value)}
            className={`${inputClass} truncate`}
          >
            <option value="">{t('household_app.settings.transfer_placeholder')}</option>
            {candidates.map((m) => (
              <option key={m.user_id} value={m.user_id}>{memberDisplayName(m, t)}</option>
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
  );
}
