'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslation } from '@/i18n';
import {
  useHouseholds,
  useSetDefaultHousehold,
  CreateHouseholdCard,
  HouseholdListCard,
  JoinHouseholdForm,
  StatusBanner,
} from '@/features/household';
import { setActiveHousehold } from '@/lib/activeHousehold';
import { describeApiError } from '@/lib/apiErrors';
import { APP_ROUTES } from '@/lib/routes';
import { useRestoreDeepLink } from '@/lib/useRestoreDeepLink';
import { Household } from '@/shared/types';

export default function HouseholdListPage() {
  const { t } = useTranslation();
  const router = useRouter();
  const { data: households, isLoading, error } = useHouseholds();
  const setDefaultMutation = useSetDefaultHousehold();
  const [status, setStatus] = useState<{ kind: 'error' | 'success'; text: string } | null>(null);
  useRestoreDeepLink();

  const openHousehold = (household: Household) => {
    setActiveHousehold(household.id);
    router.push(APP_ROUTES.detail(household.id));
  };

  const handleSetDefault = (id: string) => {
    setStatus(null);
    setDefaultMutation.mutate(id, {
      onSuccess: () => setStatus({ kind: 'success', text: t('household_app.settings.default_set') }),
      onError: (err) => setStatus({ kind: 'error', text: describeApiError(err, t) }),
    });
  };

  if (isLoading) {
    return (
      <div className="col-span-12 min-h-[60vh] flex flex-col items-center justify-center p-8 rounded-2xl bg-[var(--surface-card)] border border-[var(--border-subtle)] animate-pulse space-y-4">
        <div className="h-8 w-64 bg-[var(--surface-elevated)] rounded" />
        <div className="h-40 w-full max-w-2xl bg-[var(--surface-elevated)] rounded-xl" />
      </div>
    );
  }

  const hasHouseholds = !!households && households.length > 0;

  return (
    <div className="col-span-12 max-w-4xl mx-auto w-full space-y-8 py-4 sm:py-8">
      <div className="flex flex-col space-y-2">
        <div className="inline-flex items-center gap-2 self-start px-2.5 py-1 rounded-full bg-[var(--primary-main)]/10 text-[var(--primary-main)] text-xs font-mono border border-[var(--border-accent)]">
          <span className="material-symbols-outlined text-sm" aria-hidden="true">home</span>
          {t('household.title')}
        </div>
        <h1 className="text-3xl font-extrabold tracking-tight text-[var(--text-main)]">
          {hasHouseholds ? t('household.select_household') : t('household.no_household')}
        </h1>
        <p className="text-sm text-[var(--text-muted)] font-sans max-w-xl">
          {hasHouseholds ? t('household.select_household_desc') : t('household.no_household_desc')}
        </p>
      </div>

      {error && <StatusBanner kind="error">{describeApiError(error, t)}</StatusBanner>}
      {status && <StatusBanner kind={status.kind}>{status.text}</StatusBanner>}

      {hasHouseholds && (
        <ul className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {households.map((hh) => (
            <HouseholdListCard
              key={hh.id}
              household={hh}
              isSettingDefault={setDefaultMutation.isPending}
              onSetDefault={handleSetDefault}
              onOpen={openHousehold}
            />
          ))}
        </ul>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
        <CreateHouseholdCard
          title={t('household.create_household')}
          description={t('household.create_household_desc')}
          onCreated={(hh) => hh?.id && router.push(APP_ROUTES.detail(hh.id))}
        />

        <div className="p-6 rounded-2xl bg-[var(--surface-card)] border border-[var(--border-subtle)] flex flex-col justify-between space-y-4 shadow-lg">
          <div>
            <h2 className="flex items-center gap-2 text-sm font-bold text-[var(--text-main)] mb-1">
              <span className="material-symbols-outlined text-[var(--primary-main)]" aria-hidden="true">qr_code_scanner</span>
              <span>{t('household.join_household')}</span>
            </h2>
            <p className="text-xs text-[var(--text-muted)] leading-relaxed font-sans">
              {t('household.join_household_desc')}
            </p>
          </div>
          <JoinHouseholdForm onJoined={(hh) => hh?.id && router.push(APP_ROUTES.detail(hh.id))} />
        </div>
      </div>
    </div>
  );
}
