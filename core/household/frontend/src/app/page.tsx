'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useTranslation } from '@/i18n';
import {
  useHouseholds,
  useSetDefaultHousehold,
  CreateHouseholdCard,
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
            <li
              key={hh.id}
              className="group p-6 rounded-2xl bg-[var(--surface-card)] border border-[var(--border-subtle)] hover:border-[var(--primary-main)]/50 transition-all duration-200 flex flex-col justify-between space-y-6 shadow-md hover:shadow-xl relative overflow-hidden"
            >
              <div className="space-y-3">
                <div className="flex justify-between items-start gap-2">
                  <div className="w-10 h-10 rounded-xl bg-[var(--primary-main)]/10 border border-[var(--border-accent)] flex items-center justify-center text-[var(--primary-main)]">
                    <span className="material-symbols-outlined text-lg" aria-hidden="true">house</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    {hh.is_default && (
                      <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase bg-[var(--primary-main)]/10 text-[var(--primary-main)] border border-[var(--border-accent)] flex items-center gap-1">
                        <span className="material-symbols-outlined text-[12px]" aria-hidden="true">star</span>
                        {t('household_app.list.default_badge')}
                      </span>
                    )}
                    <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase bg-[var(--surface-canvas)] text-[var(--primary-main)] border border-[var(--border-subtle)]">
                      {hh.role || 'MEMBER'}
                    </span>
                  </div>
                </div>
                <div>
                  <h2 className="text-lg font-bold text-[var(--text-main)] group-hover:text-[var(--primary-main)] transition-colors">
                    {hh.name}
                  </h2>
                  <p className="text-xs text-[var(--text-muted)] mt-1 font-sans">
                    {hh.street ? `${hh.street}, ${hh.zip} ${hh.city}` : t('household.no_address')}
                  </p>
                </div>
              </div>
              <div className="pt-4 border-t border-[var(--border-subtle)] flex items-center justify-between gap-2 text-xs font-semibold">
                {!hh.is_default ? (
                  <button
                    type="button"
                    onClick={() => handleSetDefault(hh.id)}
                    disabled={setDefaultMutation.isPending}
                    className="text-[var(--text-muted)] hover:text-[var(--primary-main)] cursor-pointer disabled:opacity-50"
                  >
                    {t('household_app.list.set_default')}
                  </button>
                ) : <span />}
                <Link
                  href={APP_ROUTES.detail(hh.id)}
                  onClick={(e) => {
                    e.preventDefault();
                    openHousehold(hh);
                  }}
                  className="flex items-center gap-1 text-[var(--primary-main)]"
                >
                  <span>{t('household_app.list.open')}</span>
                  <span className="material-symbols-outlined text-sm group-hover:translate-x-1 transition-transform" aria-hidden="true">arrow_forward</span>
                </Link>
              </div>
            </li>
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
