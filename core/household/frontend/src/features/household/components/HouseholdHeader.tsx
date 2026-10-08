'use client';

import Link from 'next/link';
import { useTranslation } from '@/i18n';
import { Household } from '@/shared/types';
import { roleLabel } from '../roles';

interface HouseholdHeaderProps {
  household: Household;
  isOwnerOrAdmin: boolean;
  onGenerateInvite: () => void;
}

/**
 * Household header component rendering top navigation, household title, avatar badge, role badge, and invite action button.
 */
export function HouseholdHeader({
  household,
  isOwnerOrAdmin,
  onGenerateInvite,
}: HouseholdHeaderProps) {
  const { t } = useTranslation();

  const initial = household.name ? household.name.charAt(0).toUpperCase() : '';

  return (
    <div className="col-span-12 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-2">
      <div className="space-y-1 min-w-0 w-full sm:w-auto sm:flex-1">
        <Link
          href="/"
          className="flex items-center gap-1 text-xs text-[var(--text-muted)] hover:text-[var(--primary-main)] transition-colors mb-1 self-start"
        >
          <span className="material-symbols-outlined text-sm" aria-hidden="true">arrow_back</span>
          <span>{t('household.back_to_list')}</span>
        </Link>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[var(--surface-card)] border border-[var(--border-subtle)] flex items-center justify-center font-mono font-bold text-lg text-[var(--primary-main)] shrink-0 shadow-sm">
            {initial}
          </div>
          <div className="space-y-0.5 min-w-0">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1 min-w-0">
              <h1 className="text-2xl font-bold text-[var(--text-main)] min-w-0 wrap-anywhere">{household.name}</h1>
              {household.role && (
                <span className="shrink-0 px-2 py-0.5 rounded-full text-[10px] font-mono font-bold uppercase bg-[var(--primary-main)]/10 text-[var(--primary-main)] border border-[var(--border-accent)]">
                  {roleLabel(household.role, t)}
                </span>
              )}
            </div>
            {household.id && (
              <p className="text-[10px] text-[var(--text-muted)] font-mono">
                {t('household_app.detail.short_id', { id: household.id.substring(0, 8) })}
              </p>
            )}
          </div>
        </div>
      </div>

      {isOwnerOrAdmin && (
        <button
          type="button"
          onClick={onGenerateInvite}
          className="shrink-0 px-3.5 py-2 rounded-lg bg-[var(--primary-main)] text-slate-950 font-bold text-xs flex items-center gap-1.5 hover:bg-[var(--primary-hover)] transition-all cursor-pointer shadow-md"
        >
          <span className="material-symbols-outlined text-sm" aria-hidden="true">person_add</span>
          <span>{t('household.invite_member')}</span>
        </button>
      )}
    </div>
  );
}
