'use client';

import { useTranslation } from '@alfheim/shared';
import { useWebhookEvents } from '../hooks/useHomeAssistant';

const KNOWN_STATUSES = ['received', 'executed', 'skipped', 'ignored', 'failed'];

/** The 20 most recent webhook events with their outcome. */
export function EventsList() {
  const { t } = useTranslation();
  const { data, isError } = useWebhookEvents();
  const events = data ?? [];

  return (
    <section className="flex flex-col gap-2" aria-label={t('dashboard.integrations.homeassistant.events_title')}>
      <h4 className="text-xs font-bold text-[var(--text-main)]">{t('dashboard.integrations.homeassistant.events_title')}</h4>
      {isError && (
        <p role="alert" className="text-xs text-red-400">
          {t('dashboard.integrations.homeassistant.events_load_error')}
        </p>
      )}
      {events.length === 0 && !isError && (
        <p className="text-xs text-[var(--text-muted)]">{t('dashboard.integrations.homeassistant.events_empty')}</p>
      )}
      <ul className="flex flex-col gap-1">
        {events.map((ev) => {
          const status = KNOWN_STATUSES.includes(ev.status) ? ev.status : 'failed';
          return (
            <li key={ev.event_id} className="flex flex-wrap items-center gap-x-2 text-xs text-[var(--text-main)]">
              <time className="text-[var(--text-muted)]" dateTime={ev.received_at}>
                {new Date(ev.received_at).toLocaleString()}
              </time>
              <span className="font-mono">{ev.event_type}</span>
              <span data-status={status} className="font-semibold">
                {t(`dashboard.integrations.homeassistant.event_status.${status}`)}
              </span>
              {ev.detail && <span className="text-[var(--text-muted)]">{ev.detail}</span>}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
