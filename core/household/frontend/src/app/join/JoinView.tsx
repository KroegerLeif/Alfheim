'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useTranslation } from '@/i18n';
import { JoinHouseholdForm, StatusBanner } from '@/features/household';
import { APP_ROUTES } from '@/lib/routes';

export function JoinView() {
  const { t } = useTranslation();
  const router = useRouter();
  const token = useSearchParams().get('token')?.trim() ?? '';

  return (
    <div className="col-span-12 max-w-md mx-auto w-full space-y-6 py-4 sm:py-10">
      <div className="space-y-2">
        <h1 className="text-2xl font-extrabold tracking-tight text-[var(--text-main)]">{t('household_app.join.title')}</h1>
        <p className="text-sm text-[var(--text-muted)]">{t('household_app.join.description')}</p>
      </div>
      {!token && <StatusBanner kind="info">{t('household_app.join.missing_token')}</StatusBanner>}
      <div className="p-6 rounded-2xl bg-[var(--surface-card)] border border-[var(--border-subtle)]">
        <JoinHouseholdForm
          initialToken={token}
          autoSubmit={!!token}
          onJoined={(hh) => router.replace(hh?.id ? APP_ROUTES.detail(hh.id) : APP_ROUTES.list)}
        />
      </div>
    </div>
  );
}
