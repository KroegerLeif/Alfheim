import React from 'react';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { resetEnabledAppsCache } from '@alfheim/shared';
import { server } from '../../../../tests/mocks/server';
import { AutomationPanel } from '../rules/AutomationPanel';
import { buildCommandSnippet, SECRET_PLACEHOLDER } from '../rules/restCommandSnippet';
import { renderAsAdmin, serveHomeAssistant, TEMPLATE_ID, WEBHOOK_ID } from './fixtures';

describe('AutomationPanel', () => {
  beforeEach(() => resetEnabledAppsCache());

  it('shows the secret once inside the command snippet and copies it', async () => {
    serveHomeAssistant();
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
    renderAsAdmin(<AutomationPanel />);

    const snippet = await screen.findByText(/shell_command:/);
    expect(snippet.textContent).toContain(SECRET_PLACEHOLDER);
    expect(snippet.textContent).toContain(WEBHOOK_ID);
    await userEvent.click(screen.getByRole('button', { name: 'Generate secret' }));
    expect(await screen.findByText(/shown only this once/)).toBeInTheDocument();
    await waitFor(() => expect(screen.getByText(/shell_command:/).textContent).toContain('GENERATEDSECRET123'));

    await userEvent.click(screen.getByRole('button', { name: 'Copy configuration' }));
    expect(writeText).toHaveBeenCalledWith(expect.stringContaining('GENERATEDSECRET123'));
    expect(await screen.findByRole('button', { name: 'Copied' })).toBeInTheDocument();
  });

  it('reports a failed copy and a failed secret generation', async () => {
    serveHomeAssistant({ hasSecret: true });
    server.use(http.post('*api/v1/integrations/home-assistant/webhook/secret', () => new HttpResponse(null, { status: 503 })));
    Object.defineProperty(navigator, 'clipboard', { value: { writeText: vi.fn().mockRejectedValue(new Error('no')) }, configurable: true });
    renderAsAdmin(<AutomationPanel />);

    await userEvent.click(await screen.findByRole('button', { name: 'Generate new secret' }));
    expect(await screen.findByText('The secret could not be generated.')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Copy configuration' }));
    expect(await screen.findByText(/Copying failed/)).toBeInTheDocument();
  });

  it('adds, validates and deletes rules', async () => {
    serveHomeAssistant({
      rules: [{ id: 'r1', event_type: 'door_open', action: 'chores.create_instance', params: { template_id: TEMPLATE_ID }, enabled: true }],
    });
    let saved: unknown = null;
    let deleted = '';
    server.use(
      http.post('*api/v1/integrations/home-assistant/rules', async ({ request }) => {
        saved = await request.json();
        return HttpResponse.json({ id: 'r2' });
      }),
      http.delete('*api/v1/integrations/home-assistant/rules/:id', ({ params }) => {
        deleted = String(params.id);
        return new HttpResponse(null, { status: 204 });
      }),
    );
    renderAsAdmin(<AutomationPanel />);

    expect(await screen.findByText(`door_open → chore from template ${TEMPLATE_ID}`)).toBeInTheDocument();
    const rules = screen.getByRole('region', { name: 'Rules' });
    await userEvent.type(within(rules).getByLabelText('Event type'), 'Bad Type');
    await userEvent.click(within(rules).getByRole('button', { name: 'Add rule' }));
    expect(within(rules).getByRole('alert')).toHaveTextContent(/lower case letters/);
    await userEvent.clear(within(rules).getByLabelText('Event type'));
    await userEvent.type(within(rules).getByLabelText('Event type'), 'washer_finished');
    await userEvent.type(within(rules).getByLabelText('Chore template id'), 'nope');
    await userEvent.click(within(rules).getByRole('button', { name: 'Add rule' }));
    expect(within(rules).getByRole('alert')).toHaveTextContent('The template id must be a UUID.');
    await userEvent.clear(within(rules).getByLabelText('Chore template id'));
    await userEvent.type(within(rules).getByLabelText('Chore template id'), TEMPLATE_ID);
    await userEvent.click(within(rules).getByRole('button', { name: 'Add rule' }));
    await waitFor(() =>
      expect(saved).toEqual({ event_type: 'washer_finished', action: 'chores.create_instance', params: { template_id: TEMPLATE_ID } }),
    );
    await userEvent.click(within(rules).getByRole('button', { name: 'Delete the rule for door_open' }));
    await waitFor(() => expect(deleted).toBe('r1'));
  });

  it('shows the recent events, the chores notice and load errors', async () => {
    serveHomeAssistant({
      apps: ['chat'],
      events: [
        { event_id: 'e1', event_type: 'washer_finished', status: 'executed', action: 'chores.create_instance', detail: 'chore instance created', received_at: '2026-11-24T08:00:00Z' },
        { event_id: 'e2', event_type: 'odd', status: 'weird', action: '', detail: '', received_at: '2026-11-24T08:01:00Z' },
      ],
    });
    server.use(
      http.get('*api/v1/integrations/home-assistant/rules', () => new HttpResponse(null, { status: 500 })),
      http.post('*api/v1/integrations/home-assistant/rules', () => new HttpResponse(null, { status: 422 })),
    );
    renderAsAdmin(<AutomationPanel />);

    expect(await screen.findByText('chore instance created')).toBeInTheDocument();
    expect(screen.getByText('Done')).toBeInTheDocument();
    expect(screen.getByText('Failed')).toBeInTheDocument();
    expect(await screen.findByText(/events are stored as skipped/)).toBeInTheDocument();
    expect(await screen.findByText('The rules could not be loaded.')).toBeInTheDocument();
  });

  it('reports unloadable events and webhook info', async () => {
    serveHomeAssistant({ events: null });
    server.use(
      http.get('*api/v1/integrations/home-assistant/events', () => new HttpResponse(null, { status: 500 })),
      http.get('*api/v1/integrations/home-assistant/webhook', () => new HttpResponse(null, { status: 500 })),
    );
    renderAsAdmin(<AutomationPanel />);
    expect(await screen.findByText('The events could not be loaded.')).toBeInTheDocument();
    expect(await screen.findByText('The webhook could not be loaded.')).toBeInTheDocument();
  });

  it('builds the command with the event values as arguments only', () => {
    const snippet = buildCommandSnippet({ url: 'https://a.example/x', webhookId: 'id-1' });
    expect(snippet).toContain('alfheim {{ event_id }} {{ event_type }} <YOUR_WEBHOOK_SECRET> https://a.example/x id-1');
    expect(snippet.split('\n')[2]).not.toContain('{{');
  });
});
