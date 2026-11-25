import { http, HttpResponse } from 'msw';
import { server } from '../../../tests/mocks/server';
import type { Plugin } from '../types';

/** A configured, tested test-double plugin as the backend lists it. */
export const testPluginView: Plugin = {
  type: 'testdouble',
  configured: true,
  enabled: true,
  base_url: 'https://ha.example.com',
  config: { mode: 'x' },
  has_credentials: true,
  health: { status: 'ok', detail: 'connected', checked_at: '2026-11-24T00:00:00Z' },
  updated_at: '2026-11-24T00:00:00Z',
};

/** Serves GET /api/v1/integrations/plugins. */
export function servePlugins(items: Plugin[] | null, encryptionAvailable = true) {
  server.use(
    http.get('*api/v1/integrations/plugins', () =>
      HttpResponse.json({ items, encryption_available: encryptionAvailable }),
    ),
  );
}
