'use client';

import { useState } from 'react';
import { Copy, KeyRound } from 'lucide-react';
import { useTranslation } from '@alfheim/shared';
import { useRotateSecret, useWebhookInfo } from '../hooks/useHomeAssistant';
import { buildCommandSnippet } from './restCommandSnippet';

/**
 * Webhook setup: the webhook id, a button that generates the secret (shown once, held only in this
 * component's state) and the Home Assistant command to paste into `configuration.yaml`.
 */
export function WebhookSecretPanel() {
  const { t } = useTranslation();
  const info = useWebhookInfo();
  const rotate = useRotateSecret();
  const [secret, setSecret] = useState<string | undefined>();
  const [copied, setCopied] = useState(false);
  const [copyFailed, setCopyFailed] = useState(false);

  if (!info.data) {
    return info.isError ? (
      <p role="alert" className="text-xs text-red-400">
        {t('dashboard.integrations.homeassistant.webhook_load_error')}
      </p>
    ) : null;
  }
  const url = `${window.location.origin}${info.data.path}`;
  const snippet = buildCommandSnippet({ url, webhookId: info.data.webhook_id, secret });

  const generate = () =>
    rotate.mutate(undefined, {
      onSuccess: (res) => {
        setSecret(res.secret);
        setCopied(false);
      },
    });
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(snippet);
      setCopied(true);
      setCopyFailed(false);
    } catch {
      setCopyFailed(true);
    }
  };

  return (
    <section className="flex flex-col gap-2" aria-label={t('dashboard.integrations.homeassistant.webhook_title')}>
      <h4 className="text-xs font-bold text-[var(--text-main)]">{t('dashboard.integrations.homeassistant.webhook_title')}</h4>
      <p className="text-xs text-[var(--text-muted)] break-all">
        {t('dashboard.integrations.homeassistant.webhook_id', { id: info.data.webhook_id })}
      </p>
      <button
        type="button"
        onClick={generate}
        disabled={rotate.isPending}
        className="self-start inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border border-[var(--border-subtle)] text-[var(--text-main)] disabled:opacity-50"
      >
        <KeyRound className="h-3.5 w-3.5" aria-hidden="true" />
        {t(info.data.has_secret ? 'dashboard.integrations.homeassistant.secret_rotate' : 'dashboard.integrations.homeassistant.secret_generate')}
      </button>
      {rotate.isError && (
        <p role="alert" className="text-xs text-red-400">
          {t('dashboard.integrations.homeassistant.secret_error')}
        </p>
      )}
      {secret && (
        <p role="status" className="text-xs text-amber-300">
          {t('dashboard.integrations.homeassistant.secret_once')}
        </p>
      )}
      <pre className="p-3 rounded-lg text-[11px] leading-relaxed overflow-x-auto bg-[var(--surface-elevated)] text-[var(--text-main)]">
        <code>{snippet}</code>
      </pre>
      <button
        type="button"
        onClick={copy}
        className="self-start inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border border-[var(--border-subtle)] text-[var(--text-main)]"
      >
        <Copy className="h-3.5 w-3.5" aria-hidden="true" />
        {t(copied ? 'dashboard.integrations.homeassistant.copied' : 'dashboard.integrations.homeassistant.copy_snippet')}
      </button>
      {copyFailed && (
        <p role="alert" className="text-xs text-red-400">
          {t('dashboard.integrations.homeassistant.copy_failed')}
        </p>
      )}
    </section>
  );
}
