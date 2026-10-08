'use client';

import Link from 'next/link';
import { useTranslation } from '@/i18n';
import { describeApiError, getErrorStatus } from '@/lib/apiErrors';
import { APP_ROUTES } from '@/lib/routes';

/** Full-width explanation shown when a household detail page cannot be loaded. */
export function HouseholdLoadError({ error }: { error: unknown }) {
  const { t } = useTranslation();
  const status = getErrorStatus(error);
  const title = status === 403
    ? t('household_app.errors.forbidden')
    : status === 404 || !error
      ? t('household.not_found')
      : t('household_app.errors.load_failed');
  const description = error && status !== 404
    ? describeApiError(error, t, 'household')
    : t('household.not_found_desc');

  return (
    <div role="alert" className="col-span-12 flex flex-col items-center justify-center p-8 rounded-2xl bg-[var(--surface-card)] border border-[var(--border-subtle)] space-y-4 min-h-[40vh] text-center">
      <span className="material-symbols-outlined text-4xl text-[var(--text-muted)]" aria-hidden="true">{status === 403 ? 'lock' : 'error'}</span>
      <h1 className="text-lg font-bold text-[var(--text-main)]">{title}</h1>
      <p className="text-xs text-[var(--text-muted)] max-w-md wrap-anywhere">{description}</p>
      <Link href={APP_ROUTES.list} className="px-4 py-2 bg-[var(--primary-main)] text-slate-950 rounded-lg text-xs font-bold font-mono hover:bg-[var(--primary-hover)] transition-colors">
        {t('household.back_to_list')}
      </Link>
    </div>
  );
}
