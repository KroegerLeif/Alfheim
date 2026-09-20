'use client';

import { useState } from 'react';
import { Dialog, DialogContent, DialogTitle } from '@alfheim/shared';
import { useTranslation } from '@/i18n';
import { StatusBanner } from './StatusBanner';

interface DeleteHouseholdModalProps {
  isOpen: boolean;
  householdName: string;
  isPending: boolean;
  error: string | null;
  onClose: () => void;
  onConfirm: () => void;
}

/**
 * Typed-confirmation dialog: the delete button only enables once the user
 * has typed the exact household name.
 */
export function DeleteHouseholdModal({
  isOpen,
  householdName,
  isPending,
  error,
  onClose,
  onConfirm,
}: DeleteHouseholdModalProps) {
  const { t } = useTranslation();
  const [typed, setTyped] = useState('');
  const matches = typed.trim() === householdName.trim() && householdName.trim() !== '';

  const handleClose = () => {
    setTyped('');
    onClose();
  };

  if (!isOpen) return null;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) handleClose(); }}>
      <DialogContent className="bg-[var(--surface-card)] w-full max-w-md">
        <DialogTitle className="text-base font-bold text-red-300">
          {t('household_app.delete_modal.title', { name: householdName })}
        </DialogTitle>
        <p className="text-xs text-[var(--text-muted)]">{t('household_app.delete_modal.description')}</p>

        {error && <StatusBanner kind="error">{error}</StatusBanner>}

        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (matches && !isPending) onConfirm();
          }}
          className="space-y-4"
        >
          <div>
            <label htmlFor="delete-household-confirm" className="block text-xs font-mono text-[var(--text-muted)] mb-1">
              {t('household_app.delete_modal.input_label', { name: householdName })}
            </label>
            <input
              id="delete-household-confirm"
              type="text"
              autoComplete="off"
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              className="w-full px-3.5 py-2 bg-[var(--surface-canvas)] border border-[var(--border-subtle)] rounded-lg text-xs text-[var(--text-main)] focus:outline-none focus:border-red-400"
            />
          </div>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={handleClose}
              className="px-4 py-2 rounded bg-[var(--surface-canvas)] border border-[var(--border-subtle)] text-xs font-mono text-[var(--text-muted)] cursor-pointer"
            >
              {t('common.cancel')}
            </button>
            <button
              type="submit"
              disabled={!matches || isPending}
              className="px-4 py-2 rounded bg-red-500 text-white font-bold text-xs hover:bg-red-400 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {isPending ? t('household_app.delete_modal.deleting') : t('household_app.delete_modal.confirm')}
            </button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
