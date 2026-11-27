'use client';

import { useState, type FormEvent } from 'react';
import { Save } from 'lucide-react';
import { useTranslation } from '@alfheim/shared';
import { ALFI_PROVIDERS, type AlfiProvider, type HouseholdModelBlockUpdate, type ModelBlock } from './types';

interface AlfiFormProps {
  /** The household's current model block, or null to create one. */
  block: ModelBlock | null;
  isSaving: boolean;
  onSubmit: (update: HouseholdModelBlockUpdate) => void;
}

const inputClass =
  'w-full px-3 py-2 rounded-lg bg-[var(--surface-canvas)] border border-[var(--border-subtle)] text-sm text-[var(--text-main)]';

function initialProvider(block: ModelBlock | null): AlfiProvider {
  return block?.provider_type === 'openai_compatible' ? 'openai_compatible' : 'ollama';
}

/**
 * Creates or edits the household's shared model block. Presets: a local Ollama host without a
 * key, or an OpenAI-compatible API with base URL and key. The key is write-only: an empty input
 * keeps the stored one, switching to Ollama removes it.
 */
export function AlfiForm({ block, isSaving, onSubmit }: AlfiFormProps) {
  const { t } = useTranslation();
  const [provider, setProvider] = useState<AlfiProvider>(initialProvider(block));
  const [baseUrl, setBaseUrl] = useState(block?.base_url ?? '');
  const [model, setModel] = useState(block?.model_identifier ?? '');
  const [apiKey, setApiKey] = useState('');
  const needsKey = provider === 'openai_compatible';

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const update: HouseholdModelBlockUpdate = {
      display_name: block?.display_name ?? '',
      provider_type: provider,
      base_url: baseUrl.trim(),
      model_identifier: model.trim(),
    };
    if (needsKey && apiKey !== '') update.api_key = apiKey;
    if (!needsKey && block?.has_api_key) update.clear_api_key = true;
    onSubmit(update);
    setApiKey('');
  };

  return (
    <form onSubmit={submit} className="flex flex-col gap-3 pt-2 border-t border-[var(--border-subtle)]">
      <label className="flex flex-col gap-1 text-xs text-[var(--text-muted)]">
        {t('dashboard.integrations.alfi.provider')}
        <select value={provider} onChange={(e) => setProvider(e.target.value as AlfiProvider)} className={inputClass}>
          {ALFI_PROVIDERS.map((p) => (
            <option key={p} value={p}>
              {t(`dashboard.integrations.alfi.providers.${p}`)}
            </option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-1 text-xs text-[var(--text-muted)]">
        {t('dashboard.integrations.alfi.base_url')}
        <input
          type="url"
          required
          value={baseUrl}
          placeholder={t(needsKey ? 'dashboard.integrations.alfi.openai_url' : 'dashboard.integrations.alfi.ollama_url')}
          onChange={(e) => setBaseUrl(e.target.value)}
          className={inputClass}
        />
      </label>
      <label className="flex flex-col gap-1 text-xs text-[var(--text-muted)]">
        {t('dashboard.integrations.alfi.model')}
        <input
          type="text"
          required
          value={model}
          placeholder={t(needsKey ? 'dashboard.integrations.alfi.openai_model' : 'dashboard.integrations.alfi.ollama_model')}
          onChange={(e) => setModel(e.target.value)}
          className={inputClass}
        />
      </label>
      {needsKey && (
        <label className="flex flex-col gap-1 text-xs text-[var(--text-muted)]">
          {t('dashboard.integrations.alfi.api_key')}
          <input
            type="password"
            autoComplete="off"
            value={apiKey}
            required={!block?.has_api_key}
            placeholder={t(block?.has_api_key ? 'dashboard.integrations.alfi.api_key_keep' : 'dashboard.integrations.alfi.api_key_enter')}
            onChange={(e) => setApiKey(e.target.value)}
            className={inputClass}
          />
        </label>
      )}
      <p className="text-xs text-[var(--text-muted)]">{t('dashboard.integrations.alfi.allowed_hosts_hint')}</p>
      <button
        type="submit"
        disabled={isSaving}
        className="self-start inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-[var(--primary-main)] text-black disabled:opacity-50"
      >
        <Save className="h-3.5 w-3.5" aria-hidden="true" />
        {t(isSaving ? 'dashboard.integrations.alfi.saving' : 'dashboard.integrations.alfi.save')}
      </button>
    </form>
  );
}
