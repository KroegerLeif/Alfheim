'use client';

import { KeyRound, RefreshCw } from 'lucide-react';
import { useTranslation } from '@alfheim/shared';
import type { ModelBlock } from './types';

const KNOWN_HEALTH = ['ok', 'unreachable', 'auth_invalid', 'unknown'];

interface AlfiHealthBadgeProps {
  status: string;
}

/** Chat's stored health of the model block: green when the last check passed. */
export function AlfiHealthBadge({ status }: AlfiHealthBadgeProps) {
  const { t } = useTranslation();
  const key = KNOWN_HEALTH.includes(status) ? status : 'unknown';
  const label = t(`dashboard.integrations.alfi.health.${key}`);
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

interface AlfiBlockSummaryProps {
  block: ModelBlock;
  isChecking: boolean;
  onCheck: () => void;
}

/** The household's model block as every member sees it: provider, host, model and key indicator. */
export function AlfiBlockSummary({ block, isChecking, onCheck }: AlfiBlockSummaryProps) {
  const { t } = useTranslation();
  const providerKey = ['ollama', 'openai_compatible'].includes(block.provider_type)
    ? `dashboard.integrations.alfi.providers.${block.provider_type}`
    : null;

  return (
    <div className="flex flex-col gap-2">
      <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-xs">
        <dt className="text-[var(--text-muted)]">{t('dashboard.integrations.alfi.provider')}</dt>
        <dd className="text-[var(--text-main)]">{providerKey ? t(providerKey) : block.provider_type}</dd>
        <dt className="text-[var(--text-muted)]">{t('dashboard.integrations.alfi.base_url')}</dt>
        <dd className="text-[var(--text-main)] font-mono break-all">{block.base_url ?? ''}</dd>
        <dt className="text-[var(--text-muted)]">{t('dashboard.integrations.alfi.model')}</dt>
        <dd className="text-[var(--text-main)] font-mono break-all">{block.model_identifier}</dd>
      </dl>
      <p className="inline-flex items-center gap-1.5 text-xs text-[var(--text-muted)]">
        <KeyRound className="h-3.5 w-3.5" aria-hidden="true" />
        {t(block.has_api_key ? 'dashboard.integrations.alfi.api_key_stored' : 'dashboard.integrations.alfi.api_key_none')}
      </p>
      {block.health_detail && <p className="text-xs font-mono text-[var(--text-muted)] break-words">{block.health_detail}</p>}
      <button
        type="button"
        onClick={onCheck}
        disabled={isChecking}
        className="self-start inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border border-[var(--border-subtle)] text-[var(--text-main)] disabled:opacity-50"
      >
        <RefreshCw className={`h-3.5 w-3.5 ${isChecking ? 'animate-spin' : ''}`} aria-hidden="true" />
        {t(isChecking ? 'dashboard.integrations.testing' : 'dashboard.integrations.test')}
      </button>
    </div>
  );
}
