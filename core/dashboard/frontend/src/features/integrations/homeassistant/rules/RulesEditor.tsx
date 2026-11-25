'use client';

import { useState, type FormEvent } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { useTranslation } from '@alfheim/shared';
import { useDeleteRule, useRules, useSaveRule } from '../hooks/useHomeAssistant';
import { ACTION_CREATE_CHORE, EVENT_TYPE_PATTERN } from '../types';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const inputClass =
  'flex-1 min-w-0 px-3 py-1.5 rounded-lg text-xs font-mono bg-[var(--surface-elevated)] border border-[var(--border-subtle)] text-[var(--text-main)]';

/** Rules that turn a Home Assistant event type into a one-off chore from a template. */
export function RulesEditor() {
  const { t } = useTranslation();
  const { data, isError } = useRules();
  const save = useSaveRule();
  const remove = useDeleteRule();
  const [eventType, setEventType] = useState('');
  const [templateId, setTemplateId] = useState('');
  const [error, setError] = useState<string | null>(null);
  const rules = data ?? [];

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!EVENT_TYPE_PATTERN.test(eventType)) return setError(t('dashboard.integrations.homeassistant.event_type_invalid'));
    if (!UUID_PATTERN.test(templateId.trim())) return setError(t('dashboard.integrations.homeassistant.template_invalid'));
    setError(null);
    save.mutate(
      { event_type: eventType, action: ACTION_CREATE_CHORE, params: { template_id: templateId.trim() } },
      {
        onSuccess: () => {
          setEventType('');
          setTemplateId('');
        },
        onError: () => setError(t('dashboard.integrations.homeassistant.rule_error')),
      },
    );
  };

  return (
    <section className="flex flex-col gap-2" aria-label={t('dashboard.integrations.homeassistant.rules_title')}>
      <h4 className="text-xs font-bold text-[var(--text-main)]">{t('dashboard.integrations.homeassistant.rules_title')}</h4>
      {isError && (
        <p role="alert" className="text-xs text-red-400">
          {t('dashboard.integrations.homeassistant.rules_load_error')}
        </p>
      )}
      {rules.length === 0 && !isError && (
        <p className="text-xs text-[var(--text-muted)]">{t('dashboard.integrations.homeassistant.rules_empty')}</p>
      )}
      <ul className="flex flex-col gap-1">
        {rules.map((rule) => (
          <li key={rule.id} className="flex items-center justify-between gap-2 text-xs text-[var(--text-main)]">
            <span className="font-mono break-all">
              {t('dashboard.integrations.homeassistant.rule_summary', {
                event: rule.event_type,
                template: rule.params.template_id ?? '',
              })}
            </span>
            <button
              type="button"
              onClick={() => remove.mutate(rule.id)}
              aria-label={t('dashboard.integrations.homeassistant.rule_delete', { event: rule.event_type })}
            >
              <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
          </li>
        ))}
      </ul>
      <form onSubmit={submit} className="flex flex-wrap gap-2">
        <input
          value={eventType}
          onChange={(e) => setEventType(e.target.value)}
          placeholder={t('dashboard.integrations.homeassistant.event_type_placeholder')}
          aria-label={t('dashboard.integrations.homeassistant.event_type')}
          className={inputClass}
        />
        <input
          value={templateId}
          onChange={(e) => setTemplateId(e.target.value)}
          placeholder={t('dashboard.integrations.homeassistant.template_placeholder')}
          aria-label={t('dashboard.integrations.homeassistant.template_id')}
          className={inputClass}
        />
        <button
          type="submit"
          disabled={save.isPending}
          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold border border-[var(--border-subtle)] text-[var(--text-main)] disabled:opacity-50"
        >
          <Plus className="h-3.5 w-3.5" aria-hidden="true" />
          {t('dashboard.integrations.homeassistant.rule_add')}
        </button>
      </form>
      {error && (
        <p role="alert" className="text-xs text-red-400">
          {error}
        </p>
      )}
    </section>
  );
}
