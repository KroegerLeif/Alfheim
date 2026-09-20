'use client';

import React from 'react';
import { useTranslation } from '../i18n/utils/useTranslation';
import { HouseholdProvider, useActiveHousehold } from './HouseholdProvider';
import { HOUSEHOLD_APP_URLS, isHouseholdAccessError } from './householdStore';

export interface HouseholdGateProps {
  children: React.ReactNode;
  /** Rendered while the household list is loading. */
  loadingFallback?: React.ReactNode;
}

function GateCard({
  icon,
  title,
  description,
  children,
  role = 'region',
}: {
  icon: string;
  title: string;
  description: string;
  children?: React.ReactNode;
  role?: 'region' | 'alert';
}) {
  return (
    <div className="flex w-full flex-1 items-center justify-center p-6">
      <section
        role={role}
        aria-label={title}
        data-testid="household-gate"
        className="w-full max-w-md rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-card)] p-6 text-center shadow-lg"
      >
        <span aria-hidden="true" className="material-symbols-outlined text-4xl text-[var(--primary-main)]">
          {icon}
        </span>
        <h2 className="mt-3 text-lg font-bold text-[var(--text-main)]">{title}</h2>
        <p className="mt-2 text-sm text-[var(--text-muted)]">{description}</p>
        {children && <div className="mt-5 flex flex-col items-stretch gap-2">{children}</div>}
      </section>
    </div>
  );
}

const primaryAction =
  'inline-flex items-center justify-center rounded-lg bg-[var(--primary-main)] px-4 py-2 text-sm font-semibold text-black transition-opacity hover:opacity-90 cursor-pointer';
const secondaryAction =
  'inline-flex items-center justify-center rounded-lg border border-[var(--border-subtle)] px-4 py-2 text-sm font-semibold text-[var(--text-main)] transition-colors hover:border-[var(--primary-main)] cursor-pointer';

function GateContent({ children, loadingFallback }: HouseholdGateProps) {
  const { t } = useTranslation();
  const { status, error, households, householdId, setActiveHousehold, refetch } = useActiveHousehold();

  if (status === 'loading') {
    return (
      loadingFallback ?? (
        <div role="status" aria-live="polite" className="flex w-full flex-1 items-center justify-center p-6">
          <div
            aria-hidden="true"
            className="h-8 w-8 animate-spin rounded-full border-4 border-[var(--primary-main)] border-t-transparent"
          />
          <span className="sr-only">{t('household.gate.loading')}</span>
        </div>
      )
    );
  }

  if (status === 'error' || error === 'household_service_unavailable') {
    return (
      <GateCard
        role="alert"
        icon="cloud_off"
        title={t('household.gate.unavailable_title')}
        description={t('household.gate.unavailable_desc')}
      >
        <button type="button" className={primaryAction} onClick={() => void refetch()}>
          {t('household.gate.retry')}
        </button>
      </GateCard>
    );
  }

  if (status === 'none') {
    return (
      <GateCard icon="home_work" title={t('household.gate.none_title')} description={t('household.gate.none_desc')}>
        <a href={HOUSEHOLD_APP_URLS.onboarding} className={primaryAction}>
          {t('household.gate.create_or_join')}
        </a>
      </GateCard>
    );
  }

  if (isHouseholdAccessError(error)) {
    const others = households.filter((h) => h.id !== householdId);
    return (
      <GateCard
        role="alert"
        icon="lock"
        title={t('household.gate.forbidden_title')}
        description={t('household.gate.forbidden_desc')}
      >
        {others.map((h) => (
          <button key={h.id} type="button" className={secondaryAction} onClick={() => setActiveHousehold(h.id)}>
            {t('household.gate.switch_to', { name: h.name })}
          </button>
        ))}
        <a href={HOUSEHOLD_APP_URLS.onboarding} className={primaryAction}>
          {t('household.gate.create_or_join')}
        </a>
      </GateCard>
    );
  }

  // Keyed by household: switching remounts the content so effect-based fetches
  // and local state never carry over from the previous household.
  return <React.Fragment key={householdId ?? 'none'}>{children}</React.Fragment>;
}

/**
 * Renders its children only once an active household is `ready` (and remounts
 * them when the active household changes). Otherwise it
 * explains what is missing: no membership (link to household onboarding),
 * household rejected by the backend (switch or onboard), or core/household
 * unavailable (retry).
 */
export function HouseholdGate(props: HouseholdGateProps) {
  return (
    <HouseholdProvider>
      <GateContent {...props} />
    </HouseholdProvider>
  );
}
