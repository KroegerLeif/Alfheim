'use client';

import { useState } from 'react';
import { KeyRound, Plug, RefreshCw } from 'lucide-react';
import { useTranslation } from '@alfheim/shared';
import { useSavePlugin, useTestPlugin } from '../hooks/usePlugins';
import { pluginErrorKey } from '../errors';
import type { Plugin, PluginUiEntry, PluginUpdate } from '../types';
import { PluginHealthBadge } from './PluginHealthBadge';

interface PluginCardProps {
  plugin: Plugin;
  /** The plugin's name and settings form; absent for a type this frontend has no form for yet. */
  entry?: PluginUiEntry;
  canManage: boolean;
  encryptionAvailable: boolean;
}

/**
 * Generic shell of one plugin: health badge, credential indicator, enable toggle and connection
 * test. The plugin-specific settings form comes from the registry entry and is shown to OWNER and
 * ADMIN only.
 */
export function PluginCard({ plugin, entry, canManage, encryptionAvailable }: PluginCardProps) {
  const { t } = useTranslation();
  const save = useSavePlugin();
  const test = useTestPlugin();
  const [error, setError] = useState<string | null>(null);
  const title = entry ? t(entry.titleKey) : plugin.type;
  const Form = entry?.Form;

  const submit = (update: PluginUpdate) => {
    setError(null);
    save.mutate({ type: plugin.type, update }, { onError: (e) => setError(t(pluginErrorKey(e))) });
  };
  const toggle = () =>
    submit({ enabled: !plugin.enabled, base_url: plugin.base_url, config: plugin.config ?? {} });
  const runTest = () => {
    setError(null);
    test.mutate(plugin.type, { onError: (e) => setError(t(pluginErrorKey(e))) });
  };

  return (
    <article
      aria-label={title}
      className="p-5 rounded-xl bg-[var(--surface-card)] border border-[var(--border-subtle)] flex flex-col gap-3 min-w-0"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-10 h-10 rounded-xl bg-[var(--surface-elevated)] border border-[var(--border-subtle)] flex items-center justify-center text-[var(--text-main)]">
            <Plug className="h-5 w-5" aria-hidden="true" />
          </div>
          <div className="min-w-0">
            <h3 className="text-base font-bold text-[var(--text-main)] truncate">{title}</h3>
            <p className="text-xs text-[var(--text-muted)]">
              {t(plugin.enabled ? 'dashboard.integrations.enabled' : 'dashboard.integrations.disabled')}
            </p>
          </div>
        </div>
        <PluginHealthBadge status={plugin.health.status} />
      </div>

      <p className="inline-flex items-center gap-1.5 text-xs text-[var(--text-muted)]">
        <KeyRound className="h-3.5 w-3.5" aria-hidden="true" />
        {t(plugin.has_credentials ? 'dashboard.integrations.credentials_stored' : 'dashboard.integrations.credentials_missing')}
      </p>
      {plugin.health.detail && (
        <p className="text-xs font-mono text-[var(--text-muted)] break-words">{plugin.health.detail}</p>
      )}

      {canManage && (
        <div className="flex flex-wrap items-center gap-3 pt-1">
          <label className="inline-flex items-center gap-2 text-xs text-[var(--text-main)] cursor-pointer">
            <input
              type="checkbox"
              role="switch"
              checked={plugin.enabled}
              disabled={save.isPending}
              onChange={toggle}
              className="accent-[var(--primary-main)]"
            />
            {t('dashboard.integrations.enable', { name: title })}
          </label>
          <button
            type="button"
            onClick={runTest}
            disabled={!plugin.configured || test.isPending}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border border-[var(--border-subtle)] text-[var(--text-main)] disabled:opacity-50"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${test.isPending ? 'animate-spin' : ''}`} aria-hidden="true" />
            {t(test.isPending ? 'dashboard.integrations.testing' : 'dashboard.integrations.test')}
          </button>
        </div>
      )}
      {canManage && Form && (
        <Form plugin={plugin} encryptionAvailable={encryptionAvailable} isSaving={save.isPending} onSubmit={submit} />
      )}
      {error && (
        <p role="alert" className="text-xs text-red-400">
          {error}
        </p>
      )}
    </article>
  );
}
