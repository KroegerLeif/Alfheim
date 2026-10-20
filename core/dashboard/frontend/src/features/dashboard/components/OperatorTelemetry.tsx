'use client';

import { useTranslation } from '@alfheim/shared';
import { useUserCapabilities } from '../queries';
import { MetricsWidget } from './MetricsWidget';
import { SystemShellLogs } from './SystemShellLogs';

/**
 * System metrics and logs describe the whole installation, so the backend only
 * serves them to operators (Zitadel project role `alfheim_operator`). Everyone
 * else gets an explanatory note instead of widgets that would only show errors.
 */
export function OperatorTelemetry() {
  const { t } = useTranslation();
  const { data: capabilities, isLoading } = useUserCapabilities();

  if (isLoading) return null;

  if (!capabilities?.operator) {
    return (
      <div className="col-span-12 p-6 rounded-2xl bg-[var(--surface-card)] border border-[var(--border-subtle)]">
        <h2 className="text-base font-bold text-[var(--text-main)] mb-1">{t('dashboard.operator_only_title')}</h2>
        <p className="text-xs text-[var(--text-muted)]">{t('dashboard.operator_only_desc')}</p>
      </div>
    );
  }

  return (
    <>
      <MetricsWidget />
      <SystemShellLogs />
    </>
  );
}
