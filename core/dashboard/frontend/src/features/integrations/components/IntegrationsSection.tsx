'use client';

import { Plug } from 'lucide-react';
import { useActiveHousehold, useTranslation } from '@alfheim/shared';
import { useCanManagePlugins, usePlugins } from '../hooks/usePlugins';
import type { PluginUiRegistry } from '../types';
import { PluginCard } from './PluginCard';

interface IntegrationsSectionProps {
  /** Per-type names and settings forms; each plugin adds one entry. */
  registry: PluginUiRegistry;
  /** Cards that are not backend plugin types, such as ALFI's view over chat; shown after the plugins. */
  extra?: React.ReactNode;
}

/**
 * Household integrations under the dashboard settings: every plugin type of this build with its
 * health, visible to all members and managed by owners and admins.
 */
export function IntegrationsSection({ registry, extra }: IntegrationsSectionProps) {
  const { t } = useTranslation();
  const { status } = useActiveHousehold();
  const { data, isLoading, isError } = usePlugins();
  const canManage = useCanManagePlugins();
  const items = data?.items ?? [];
  const encryptionAvailable = data?.encryption_available ?? false;

  const notice = (key: string, tone: 'muted' | 'error' = 'muted') => (
    <p
      role={tone === 'error' ? 'alert' : undefined}
      className={`col-span-full p-6 rounded-xl text-xs font-mono ${
        tone === 'error'
          ? 'bg-red-950/20 border border-red-800/40 text-red-300'
          : 'bg-[var(--surface-card)] border border-dashed border-[var(--border-subtle)] text-[var(--text-muted)] text-center'
      }`}
    >
      {t(key)}
    </p>
  );

  let body: React.ReactNode;
  if (status !== 'ready' && status !== 'loading') {
    body = notice('dashboard.integrations.no_household');
  } else if (status === 'loading' || isLoading) {
    body = <div className="col-span-full h-32 rounded-xl bg-[var(--surface-card)] animate-pulse" />;
  } else if (isError) {
    body = notice('dashboard.integrations.load_error', 'error');
  } else if (items.length === 0) {
    body = notice('dashboard.integrations.empty');
  } else {
    body = items.map((plugin) => (
      <PluginCard
        key={plugin.type}
        plugin={plugin}
        entry={registry[plugin.type]}
        canManage={canManage}
        encryptionAvailable={encryptionAvailable}
      />
    ));
  }

  return (
    <section className="col-span-12 mt-6" aria-labelledby="integrations-heading">
      <div className="flex items-center gap-2 mb-1">
        <Plug className="h-5 w-5 text-[var(--primary-main)]" aria-hidden="true" />
        <h2 id="integrations-heading" className="text-lg font-bold text-[var(--text-main)]">
          {t('dashboard.integrations.title')}
        </h2>
      </div>
      <p className="text-xs text-[var(--text-muted)] mb-4">{t('dashboard.integrations.subtitle')}</p>
      {canManage && data && !encryptionAvailable && (
        <div className="mb-4">{notice('dashboard.integrations.encryption_unavailable', 'error')}</div>
      )}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {body}
        {status === 'ready' && extra}
      </div>
    </section>
  );
}
