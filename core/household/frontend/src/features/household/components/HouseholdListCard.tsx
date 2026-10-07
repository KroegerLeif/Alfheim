'use client';

import Link from 'next/link';
import { useTranslation } from '@/i18n';
import { APP_ROUTES } from '@/lib/routes';
import { Household } from '@/shared/types';
import { roleLabel } from '../roles';

interface HouseholdListCardProps {
  household: Household;
  isSettingDefault: boolean;
  onSetDefault: (id: string) => void;
  onOpen: (household: Household) => void;
}

/** One household on the list page: name, address, role/default badges and actions. */
export function HouseholdListCard({ household: hh, isSettingDefault, onSetDefault, onOpen }: HouseholdListCardProps) {
  const { t } = useTranslation();
  const address = hh.street ? `${hh.street}, ${hh.zip} ${hh.city}` : t('household.no_address');

  return (
    <li className="group p-6 rounded-2xl bg-[var(--surface-card)] border border-[var(--border-subtle)] hover:border-[var(--primary-main)]/50 transition-all duration-200 flex flex-col justify-between space-y-6 shadow-md hover:shadow-xl relative overflow-hidden min-w-0">
      <div className="space-y-3 min-w-0">
        <div className="flex justify-between items-start gap-2">
          <div className="w-10 h-10 shrink-0 rounded-xl bg-[var(--primary-main)]/10 border border-[var(--border-accent)] flex items-center justify-center text-[var(--primary-main)]">
            <span className="material-symbols-outlined text-lg" aria-hidden="true">house</span>
          </div>
          <div className="flex flex-wrap justify-end items-center gap-1.5 min-w-0">
            {hh.is_default && (
              <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase bg-[var(--primary-main)]/10 text-[var(--primary-main)] border border-[var(--border-accent)] flex items-center gap-1">
                <span className="material-symbols-outlined text-[12px]" aria-hidden="true">star</span>
                {t('household_app.list.default_badge')}
              </span>
            )}
            {hh.role && (
              <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase bg-[var(--surface-canvas)] text-[var(--primary-main)] border border-[var(--border-subtle)]">
                {roleLabel(hh.role, t)}
              </span>
            )}
          </div>
        </div>
        <div className="min-w-0">
          <h2 className="text-lg font-bold text-[var(--text-main)] group-hover:text-[var(--primary-main)] transition-colors wrap-anywhere">
            {hh.name}
          </h2>
          <p className="text-xs text-[var(--text-muted)] mt-1 font-sans wrap-anywhere">{address}</p>
        </div>
      </div>
      <div className="pt-4 border-t border-[var(--border-subtle)] flex flex-wrap items-center justify-between gap-2 text-xs font-semibold">
        {!hh.is_default ? (
          <button
            type="button"
            onClick={() => onSetDefault(hh.id)}
            disabled={isSettingDefault}
            className="text-[var(--text-muted)] hover:text-[var(--primary-main)] cursor-pointer disabled:opacity-50"
          >
            {t('household_app.list.set_default')}
          </button>
        ) : <span />}
        <Link
          href={APP_ROUTES.detail(hh.id)}
          onClick={(e) => {
            e.preventDefault();
            onOpen(hh);
          }}
          className="flex items-center gap-1 text-[var(--primary-main)]"
        >
          <span>{t('household_app.list.open')}</span>
          <span className="material-symbols-outlined text-sm group-hover:translate-x-1 transition-transform" aria-hidden="true">arrow_forward</span>
        </Link>
      </div>
    </li>
  );
}
