'use client';

import { useTranslation } from '@alfheim/shared';
import { AppHealthState } from '@/shared/types';

const STYLES: Record<AppHealthState | 'unknown', { dot: string; text: string }> = {
  online: { dot: 'bg-emerald-400', text: 'text-emerald-400' },
  degraded: { dot: 'bg-amber-400', text: 'text-amber-400' },
  offline: { dot: 'bg-red-400', text: 'text-red-400' },
  unknown: { dot: 'bg-[var(--text-muted)] animate-pulse', text: 'text-[var(--text-muted)]' },
};

interface AppHealthBadgeProps {
  /** Live state from the dashboard backend; undefined while the first probe is pending. */
  state?: AppHealthState;
}

/** Small live-health indicator shown next to the configured status on an app card. */
export function AppHealthBadge({ state }: AppHealthBadgeProps) {
  const { t } = useTranslation();
  const key = state ?? 'unknown';
  const label = t(`dashboard.health_${key}`);
  const style = STYLES[key];

  return (
    <span
      role="status"
      aria-label={t('dashboard.health_label', { state: label })}
      data-health={key}
      className={`inline-flex items-center gap-1 text-[10px] font-mono uppercase ${style.text}`}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${style.dot}`} aria-hidden="true" />
      {label}
    </span>
  );
}
