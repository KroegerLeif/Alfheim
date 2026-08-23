'use client';

import { useTranslation } from '@alfheim/shared';

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

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-[var(--surface-card)] border border-[var(--border-subtle)] rounded-2xl w-full max-w-md p-6 shadow-2xl space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-[var(--border-subtle)]">
          <h3 className="text-base font-bold text-[var(--text-main)]">{t('household.create_household')}</h3>
          <button onClick={onClose} className="text-[var(--text-muted)] hover:text-[var(--text-main)] cursor-pointer">
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        {createStatus && (
          <div className="p-3 rounded bg-red-950/40 border border-red-800/40 text-red-300 text-xs font-mono">
            {createStatus}
          </div>
        )}

        <form onSubmit={onSubmit} className="space-y-4">
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
      </div>
    </div>
  );
}
