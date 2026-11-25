'use client';

import { useState, type FormEvent } from 'react';
import { Save } from 'lucide-react';
import { useTranslation } from '@alfheim/shared';
import type { PluginFormProps } from '../types';
import type { MediaCredentialField } from './types';

interface MediaServerFormProps extends PluginFormProps {
  /** Credential inputs of this server type; they are write-only and start empty. */
  fields: MediaCredentialField[];
  /** i18n key of the base URL placeholder, for example `http://jellyfin.lan:8096`. */
  urlPlaceholderKey: string;
}

const inputClass =
  'w-full px-3 py-2 rounded-lg bg-[var(--surface-canvas)] border border-[var(--border-subtle)] text-sm text-[var(--text-main)]';

/**
 * Settings of a LAN media server: base URL and write-only credentials. Empty credential inputs
 * keep the stored ones; filling every input replaces them. A new plugin is enabled on first save.
 */
export function MediaServerForm({ plugin, encryptionAvailable, isSaving, onSubmit, fields, urlPlaceholderKey }: MediaServerFormProps) {
  const { t } = useTranslation();
  const [baseUrl, setBaseUrl] = useState(plugin.base_url);
  const [values, setValues] = useState<Record<string, string>>({});
  const [incomplete, setIncomplete] = useState(false);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const filled = fields.filter((f) => (values[f.name] ?? '') !== '');
    if (filled.length > 0 && filled.length < fields.length) {
      setIncomplete(true);
      return;
    }
    setIncomplete(false);
    const credentials = filled.length > 0 ? Object.fromEntries(fields.map((f) => [f.name, values[f.name]])) : undefined;
    onSubmit({
      enabled: plugin.configured ? plugin.enabled : true,
      base_url: baseUrl.trim(),
      config: {},
      ...(credentials ? { credentials } : {}),
    });
    setValues({});
  };

  return (
    <form onSubmit={submit} className="flex flex-col gap-3 pt-2 border-t border-[var(--border-subtle)]">
      <label className="flex flex-col gap-1 text-xs text-[var(--text-muted)]">
        {t('dashboard.integrations.media.base_url')}
        <input
          type="url"
          required
          value={baseUrl}
          placeholder={t(urlPlaceholderKey)}
          onChange={(e) => setBaseUrl(e.target.value)}
          className={inputClass}
        />
      </label>
      {encryptionAvailable &&
        fields.map((field) => (
          <label key={field.name} className="flex flex-col gap-1 text-xs text-[var(--text-muted)]">
            {t(field.labelKey)}
            <input
              type={field.type}
              autoComplete="off"
              value={values[field.name] ?? ''}
              placeholder={t(plugin.has_credentials ? 'dashboard.integrations.media.keep_credentials' : 'dashboard.integrations.media.enter_credentials')}
              onChange={(e) => setValues({ ...values, [field.name]: e.target.value })}
              className={inputClass}
            />
          </label>
        ))}
      <p className="text-xs text-[var(--text-muted)]">{t('dashboard.integrations.media.lan_only')}</p>
      {incomplete && (
        <p role="alert" className="text-xs text-red-400">
          {t('dashboard.integrations.media.credentials_incomplete')}
        </p>
      )}
      <button
        type="submit"
        disabled={isSaving}
        className="self-start inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-[var(--primary-main)] text-black disabled:opacity-50"
      >
        <Save className="h-3.5 w-3.5" aria-hidden="true" />
        {t('dashboard.integrations.media.save')}
      </button>
    </form>
  );
}
