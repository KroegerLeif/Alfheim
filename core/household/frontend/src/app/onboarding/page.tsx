'use client';

import { useRouter } from 'next/navigation';
import { useTranslation } from '@/i18n';
import { CreateHouseholdCard, JoinHouseholdForm } from '@/features/household';
import { APP_ROUTES } from '@/lib/routes';

/**
 * Onboarding for users without any household (see OnboardingGate).
 * Offers "create" or "join with code/QR"; either way the new household
 * becomes active and the user lands on its detail page.
 */
export default function OnboardingPage() {
  const { t } = useTranslation();
  const router = useRouter();
  const goTo = (id?: string) => router.replace(id ? APP_ROUTES.detail(id) : APP_ROUTES.list);

  return (
    <div className="col-span-12 max-w-3xl mx-auto w-full space-y-8 py-4 sm:py-10">
      <div className="flex flex-col space-y-2">
        <div className="inline-flex items-center gap-2 self-start px-2.5 py-1 rounded-full bg-[var(--primary-main)]/10 text-[var(--primary-main)] text-xs font-mono border border-[var(--border-accent)]">
          <span className="material-symbols-outlined text-sm" aria-hidden="true">waving_hand</span>
          {t('household_app.onboarding.badge')}
        </div>
        <h1 className="text-3xl font-extrabold tracking-tight text-[var(--text-main)]">
          {t('household_app.onboarding.title')}
        </h1>
        <p className="text-sm text-[var(--text-muted)] max-w-xl">{t('household_app.onboarding.description')}</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
        <CreateHouseholdCard
          title={t('household_app.onboarding.create_title')}
          description={t('household_app.onboarding.create_desc')}
          onCreated={(hh) => goTo(hh?.id)}
        />
        <div className="p-6 rounded-2xl bg-[var(--surface-card)] border border-[var(--border-subtle)] flex flex-col justify-between space-y-4 shadow-lg">
          <div>
            <h2 className="flex items-center gap-2 text-sm font-bold text-[var(--text-main)] mb-1">
              <span className="material-symbols-outlined text-[var(--primary-main)]" aria-hidden="true">qr_code_scanner</span>
              <span>{t('household_app.onboarding.join_title')}</span>
            </h2>
            <p className="text-xs text-[var(--text-muted)] leading-relaxed">{t('household_app.onboarding.join_desc')}</p>
          </div>
          <JoinHouseholdForm onJoined={(hh) => goTo(hh?.id)} />
        </div>
      </div>
    </div>
  );
}
