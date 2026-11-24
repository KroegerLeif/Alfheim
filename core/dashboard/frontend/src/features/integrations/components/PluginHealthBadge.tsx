'use client';

import { useTranslation } from '@alfheim/shared';
import { knownHealthStatus } from '../errors';

interface PluginHealthBadgeProps {
  /** Status from the last connection test, as the backend stored it. */
  status: string;
}

/** Status of a plugin's last connection test: green when it passed, red when it failed. */
export function PluginHealthBadge({ status }: PluginHealthBadgeProps) {
  const { t } = useTranslation();
  const key = knownHealthStatus(status);
  const label = t(`dashboard.integrations.status.${key}`);
  let tone = 'text-red-400 bg-red-500/10 border-red-500/20';
  if (key === 'ok') tone = 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20';
  if (key === 'unknown') tone = 'text-[var(--text-muted)] bg-[var(--surface-elevated)] border-[var(--border-subtle)]';

  return (
    <span
      role="status"
      aria-label={t('dashboard.integrations.status_label', { status: label })}
      data-health={key}
      className={`inline-flex items-center px-2 py-0.5 rounded border text-[10px] font-mono uppercase ${tone}`}
    >
      {label}
    </span>
  );
}
