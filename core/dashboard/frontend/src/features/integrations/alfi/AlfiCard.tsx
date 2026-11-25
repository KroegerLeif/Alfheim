'use client';

import { useState, type ReactNode } from 'react';
import { Bot } from 'lucide-react';
import { useTranslation } from '@alfheim/shared';
import { useCanManagePlugins } from '../hooks/usePlugins';
import { AlfiBlockSummary, AlfiHealthBadge } from './AlfiBlockSummary';
import { AlfiForm } from './AlfiForm';
import { alfiErrorKey } from './errors';
import { useChatInstalled, useCheckModelBlock, useHouseholdModelBlock, useSaveHouseholdModelBlock } from './useAlfi';

/** The installer command that adds the chat app to a Lean Core installation. */
export const ENABLE_CHAT_COMMAND = 'alfheim-setup apps enable chat';

const muted = 'text-xs text-[var(--text-muted)]';

/**
 * ALFI's LLM provider card in the integrations settings. It is a view over chat's household
 * shared model block (ADR 0010 §5): read and written through chat's public API with the user's
 * token, never stored by the dashboard. Without the chat app it shows how to enable it.
 */
export function AlfiCard() {
  const { t } = useTranslation();
  const chatInstalled = useChatInstalled();
  const { data: block, isLoading, isError } = useHouseholdModelBlock(chatInstalled);
  const canManage = useCanManagePlugins();
  const save = useSaveHouseholdModelBlock();
  const check = useCheckModelBlock();
  const [error, setError] = useState<string | null>(null);
  const onError = (e: Error) => setError(t(alfiErrorKey(e)));

  let body: ReactNode;
  let badge: ReactNode = null;
  if (chatInstalled === undefined || (chatInstalled && isLoading)) {
    body = <div className="h-16 rounded-lg bg-[var(--surface-elevated)] animate-pulse" />;
  } else if (!chatInstalled) {
    body = (
      <>
        <p className={muted}>{t('dashboard.integrations.alfi.not_installed')}</p>
        <p className={muted}>{t('dashboard.integrations.alfi.enable_hint')}</p>
        <code className="block px-3 py-2 rounded-lg bg-[var(--surface-canvas)] border border-[var(--border-subtle)] text-xs font-mono text-[var(--text-main)]">
          {ENABLE_CHAT_COMMAND}
        </code>
      </>
    );
  } else if (isError) {
    body = (
      <p role="alert" className="text-xs text-red-400">
        {t('dashboard.integrations.alfi.load_error')}
      </p>
    );
  } else {
    badge = block ? <AlfiHealthBadge status={block.health_status} /> : null;
    body = (
      <>
        {block ? (
          <AlfiBlockSummary
            block={block}
            isChecking={check.isPending}
            onCheck={() => {
              setError(null);
              check.mutate(block.id, { onError });
            }}
          />
        ) : (
          <p className={muted}>{t('dashboard.integrations.alfi.no_model')}</p>
        )}
        {block && block.health_status !== 'ok' && <p className={muted}>{t('dashboard.integrations.alfi.disabled_until_healthy')}</p>}
        {canManage ? (
          <AlfiForm
            key={block?.id ?? 'new'}
            block={block ?? null}
            isSaving={save.isPending}
            onSubmit={(update) => {
              setError(null);
              save.mutate(update, { onError });
            }}
          />
        ) : (
          !block && <p className={muted}>{t('dashboard.integrations.alfi.ask_admin')}</p>
        )}
      </>
    );
  }

  return (
    <article
      aria-label={t('dashboard.integrations.alfi.title')}
      className="p-5 rounded-xl bg-[var(--surface-card)] border border-[var(--border-subtle)] flex flex-col gap-3 min-w-0"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-10 h-10 rounded-xl bg-[var(--surface-elevated)] border border-[var(--border-subtle)] flex items-center justify-center text-[var(--text-main)]">
            <Bot className="h-5 w-5" aria-hidden="true" />
          </div>
          <div className="min-w-0">
            <h3 className="text-base font-bold text-[var(--text-main)] truncate">{t('dashboard.integrations.alfi.title')}</h3>
            <p className={muted}>{t('dashboard.integrations.alfi.subtitle')}</p>
          </div>
        </div>
        {badge}
      </div>
      {body}
      {error && (
        <p role="alert" className="text-xs text-red-400">
          {error}
        </p>
      )}
    </article>
  );
}
