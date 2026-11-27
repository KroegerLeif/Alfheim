'use client';

import { Workflow } from 'lucide-react';
import { useAppEnabled, useTranslation } from '@alfheim/shared';
import { EventsList } from './EventsList';
import { RulesEditor } from './RulesEditor';
import { WebhookSecretPanel } from './WebhookSecretPanel';

/**
 * Home Assistant automations that trigger Alfheim actions: webhook setup, rules and the recent
 * events. Without chores installed, events are stored as skipped, which the notice explains.
 */
export function AutomationPanel() {
  const { t } = useTranslation();
  const choresInstalled = useAppEnabled('chores');

  return (
    <div className="flex flex-col gap-4 border-t border-[var(--border-subtle)] pt-3">
      <div className="flex items-center gap-2">
        <Workflow className="h-4 w-4 text-[var(--primary-main)]" aria-hidden="true" />
        <h3 className="text-sm font-bold text-[var(--text-main)]">{t('dashboard.integrations.homeassistant.automations_title')}</h3>
      </div>
      <p className="text-xs text-[var(--text-muted)]">{t('dashboard.integrations.homeassistant.automations_hint')}</p>
      {choresInstalled === false && (
        <p role="status" className="text-xs text-amber-300">
          {t('dashboard.integrations.homeassistant.chores_missing')}
        </p>
      )}
      <WebhookSecretPanel />
      <RulesEditor />
      <EventsList />
    </div>
  );
}
