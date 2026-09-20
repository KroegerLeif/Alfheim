'use client';

import { Dialog, DialogContent, DialogTitle } from '@alfheim/shared';
import { useTranslation } from '@/i18n';

interface HouseholdCreateModalProps {
  isOpen: boolean;
  onClose: () => void;
  newHouseholdName: string;
  setNewHouseholdName: (val: string) => void;
  createStatus: string | null;
  onSubmit: (e: React.FormEvent) => void;
  isPending: boolean;
}

export function HouseholdCreateModal({
  isOpen,
  onClose,
  newHouseholdName,
  setNewHouseholdName,
  createStatus,
  onSubmit,
  isPending,
}: HouseholdCreateModalProps) {
  const { t } = useTranslation();

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="bg-[var(--surface-card)] w-full max-w-md">
        <DialogTitle className="text-base font-bold text-[var(--text-main)]">{t('household.create_household')}</DialogTitle>

        {createStatus && (
          <div className="p-3 rounded bg-red-950/40 border border-red-800/40 text-red-300 text-xs font-mono">
            {createStatus}
          </div>
        )}

        <form onSubmit={onSubmit} className="space-y-4">
          <div>
            <label htmlFor="household-create-name" className="block text-xs font-mono uppercase text-[var(--text-muted)] mb-1">
              {t('household_app.create.name_label')} *
            </label>
            <input
              id="household-create-name"
              type="text"
              value={newHouseholdName}
              onChange={(e) => setNewHouseholdName(e.target.value)}
              placeholder={t('household.household_name_placeholder')}
              className="w-full px-3.5 py-2 bg-[var(--surface-canvas)] border border-[var(--border-subtle)] rounded-lg text-xs text-[var(--text-main)] focus:outline-none focus:border-[var(--primary-main)]"
              required
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => onClose()}
              className="px-4 py-2 rounded bg-[var(--surface-canvas)] border border-[var(--border-subtle)] text-xs font-mono text-[var(--text-muted)] cursor-pointer"
            >
              {t('common.cancel')}
            </button>
            <button
              type="submit"
              disabled={isPending}
              className="px-4 py-2 rounded bg-[var(--primary-main)] text-slate-950 font-bold text-xs hover:bg-[var(--primary-hover)] cursor-pointer disabled:opacity-50"
            >
              {isPending ? t('common.loading') : t('household.create_household')}
            </button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
