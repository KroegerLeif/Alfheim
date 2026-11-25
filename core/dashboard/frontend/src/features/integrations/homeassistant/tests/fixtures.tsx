import React, { type ReactElement } from 'react';
import { http, HttpResponse } from 'msw';
import { StaticHouseholdProvider } from '@alfheim/shared';
import { server } from '../../../../tests/mocks/server';
import { renderWithProviders } from '../../../../tests/test-utils';
import type { Plugin } from '../../types';
import type { ActionRule, WebhookEvent } from '../types';

export const WEBHOOK_ID = '44444444-4444-4444-8444-444444444444';
export const TEMPLATE_ID = '33333333-3333-4333-8333-333333333333';

/** A configured Home Assistant plugin as the backend lists it. */
export const haPlugin: Plugin = {
  type: 'homeassistant',
  configured: true,
  enabled: true,
  base_url: 'http://ha.lan:8123',
  config: { pinned_entities: ['sensor.temp'], allow_control: false },
  has_credentials: true,
  health: { status: 'ok', detail: '', checked_at: null },
  updated_at: null,
};

interface ServeOptions {
  apps?: string[];
  rules?: ActionRule[];
  events?: WebhookEvent[] | null;
  hasSecret?: boolean;
}

/** Serves the enabled apps and every Home Assistant admin endpoint. */
export function serveHomeAssistant({ apps = ['chat', 'chores'], rules = [], events = [], hasSecret = false }: ServeOptions = {}) {
  server.use(
    http.get('*/api/v1/apps/enabled', () => HttpResponse.json({ apps })),
    http.get('*api/v1/integrations/home-assistant/webhook', () =>
      HttpResponse.json({ webhook_id: WEBHOOK_ID, has_secret: hasSecret, path: '/api/v1/integrations/home-assistant/events' }),
    ),
    http.post('*api/v1/integrations/home-assistant/webhook/secret', () =>
      HttpResponse.json({
        webhook_id: WEBHOOK_ID,
        has_secret: true,
        path: '/api/v1/integrations/home-assistant/events',
        secret: 'GENERATEDSECRET123',
      }),
    ),
    http.get('*api/v1/integrations/home-assistant/rules', () => HttpResponse.json({ items: rules })),
    http.get('*api/v1/integrations/home-assistant/events', () => HttpResponse.json({ items: events })),
  );
}

/** Renders ui inside an admin household. */
export function renderAsAdmin(ui: ReactElement) {
  return renderWithProviders(
    <StaticHouseholdProvider householdId="hh-a" value={{ role: 'ADMIN' }}>
      {ui}
    </StaticHouseholdProvider>,
  );
}
