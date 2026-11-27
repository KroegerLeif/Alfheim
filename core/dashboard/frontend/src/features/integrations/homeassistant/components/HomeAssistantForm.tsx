'use client';

import { useState, type FormEvent } from 'react';
import { Save } from 'lucide-react';
import { useAppEnabled, useTranslation } from '@alfheim/shared';
import type { PluginFormProps, PluginUpdate } from '../../types';
import { readSettings } from '../types';
import { AutomationPanel } from '../rules/AutomationPanel';
import { PinnedEntitiesPicker } from './PinnedEntitiesPicker';

const inputClass =
  'w-full px-3 py-1.5 rounded-lg text-xs bg-[var(--surface-elevated)] border border-[var(--border-subtle)] text-[var(--text-main)]';

/**
 * Settings of the Home Assistant plugin: address, long-lived access token (write-only), pinned
 * entities and, when chat is installed, whether ALFI may control devices. Below it, once the
 * plugin is stored, the webhook automations.
 */
export function HomeAssistantForm({ plugin, encryptionAvailable, isSaving, onSubmit }: PluginFormProps) {
  const { t } = useTranslation();
  const chatInstalled = useAppEnabled('chat') === true;
  const initial = readSettings(plugin.config);
  const [baseUrl, setBaseUrl] = useState(plugin.base_url);
  const [token, setToken] = useState('');
  const [pinned, setPinned] = useState(initial.pinned_entities);
  const [allowControl, setAllowControl] = useState(initial.allow_control);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const update: PluginUpdate = {
      enabled: plugin.enabled,
      base_url: baseUrl.trim(),
      // Without chat the setting has no effect; keep the stored value instead of dropping it.
      config: { pinned_entities: pinned, allow_control: chatInstalled ? allowControl : initial.allow_control },
    };
    if (token.trim()) update.credentials = { token: token.trim() };
    onSubmit(update);
    setToken('');
  };

  return (
    <div className="flex flex-col gap-4 border-t border-[var(--border-subtle)] pt-3">
      <form onSubmit={submit} className="flex flex-col gap-3" aria-label={t('dashboard.integrations.homeassistant.settings')}>
        <label className="flex flex-col gap-1 text-xs font-semibold text-[var(--text-main)]">
          {t('dashboard.integrations.homeassistant.base_url')}
          <input
            type="url"
            required
            value={baseUrl}
            onChange={(e) => setBaseUrl(e.target.value)}
            placeholder={t('dashboard.integrations.homeassistant.base_url_placeholder')}
            className={inputClass}
          />
        </label>
        {encryptionAvailable && (
          <label className="flex flex-col gap-1 text-xs font-semibold text-[var(--text-main)]">
            {t('dashboard.integrations.homeassistant.token')}
            <input
              type="password"
              autoComplete="off"
              value={token}
              onChange={(e) => setToken(e.target.value)}
              placeholder={t(
                plugin.has_credentials
                  ? 'dashboard.integrations.homeassistant.token_keep'
                  : 'dashboard.integrations.homeassistant.token_placeholder',
              )}
              className={inputClass}
            />
          </label>
        )}
        <PinnedEntitiesPicker value={pinned} onChange={setPinned} disabled={isSaving} />
        {chatInstalled && (
          <label className="inline-flex items-start gap-2 text-xs text-[var(--text-main)]">
            <input
              type="checkbox"
              checked={allowControl}
              onChange={(e) => setAllowControl(e.target.checked)}
              className="mt-0.5 accent-[var(--primary-main)]"
            />
            <span>
              <span className="font-semibold">{t('dashboard.integrations.homeassistant.allow_control')}</span>
              <span className="block text-[var(--text-muted)]">{t('dashboard.integrations.homeassistant.allow_control_hint')}</span>
            </span>
          </label>
        )}
        <button
          type="submit"
          disabled={isSaving}
          className="self-start inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-[var(--primary-main)] text-black disabled:opacity-50"
        >
          <Save className="h-3.5 w-3.5" aria-hidden="true" />
          {t('dashboard.integrations.homeassistant.save')}
        </button>
      </form>
      {plugin.configured && <AutomationPanel />}
    </div>
  );
}
