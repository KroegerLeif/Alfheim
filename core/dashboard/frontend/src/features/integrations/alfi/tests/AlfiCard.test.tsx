import React from 'react';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';
import { StaticHouseholdProvider } from '@alfheim/shared';
import { server } from '../../../../tests/mocks/server';
import { renderWithProviders } from '../../../../tests/test-utils';
import { AlfiCard } from '../AlfiCard';
import type { ModelBlock } from '../types';

const healthy: ModelBlock = {
  id: 'mb-1',
  display_name: 'ALFI',
  provider_type: 'openai_compatible',
  base_url: 'https://api.example.eu/v1',
  model_identifier: 'mistral-small-latest',
  has_api_key: true,
  visibility: 'shared',
  household_id: 'hh-a',
  health_status: 'ok',
};

function serveChat(chat: boolean, block: ModelBlock | null | 'error') {
  server.use(
    http.get('*api/v1/user/capabilities', () => HttpResponse.json({ operator: false, chat })),
    http.get('*api/v1/chat/model-blocks/household-default', () => {
      if (block === 'error') return HttpResponse.json({}, { status: 502 });
      if (block === null) return HttpResponse.json({ error: 'not_found', message: 'model block not found' }, { status: 404 });
      return HttpResponse.json(block);
    }),
  );
}

function renderCard(role = 'OWNER') {
  return renderWithProviders(
    <StaticHouseholdProvider householdId="hh-a" value={{ role }}>
      <AlfiCard />
    </StaticHouseholdProvider>,
  );
}

describe('AlfiCard', () => {
  it('shows the disabled card with the enable command when chat is not installed', async () => {
    let chatCalled = false;
    server.use(
      http.get('*api/v1/user/capabilities', () => HttpResponse.json({ operator: true, chat: false })),
      http.get('*api/v1/chat/*', () => {
        chatCalled = true;
        return HttpResponse.json({});
      }),
    );
    renderCard();
    expect(await screen.findByText('Chat module not installed. ALFI is disabled.')).toBeInTheDocument();
    expect(screen.getByText('alfheim-setup apps enable chat')).toBeInTheDocument();
    expect(screen.queryByLabelText('Provider')).not.toBeInTheDocument();
    expect(chatCalled).toBe(false);
  });

  it('explains that ALFI is off while chat has no model block', async () => {
    serveChat(true, null);
    renderCard('MEMBER');
    expect(await screen.findByText('No model is configured, so ALFI stays disabled.')).toBeInTheDocument();
    expect(screen.getByText(/Ask a household owner or admin/)).toBeInTheDocument();
    expect(screen.queryByLabelText('Provider')).not.toBeInTheDocument();
  });

  it('shows a healthy block without ever rendering the key', async () => {
    serveChat(true, healthy);
    renderCard();
    expect(await screen.findByRole('status', { name: 'Connection status: Connected' })).toBeInTheDocument();
    expect(screen.getByText('API key stored')).toBeInTheDocument();
    expect(screen.getByLabelText('API key')).toHaveValue('');
    expect(screen.queryByText(/disabled until|stays hidden/)).not.toBeInTheDocument();
  });

  it('marks an unhealthy block and keeps ALFI hidden', async () => {
    serveChat(true, { ...healthy, health_status: 'unreachable', health_detail: 'connection refused' });
    renderCard('MEMBER');
    expect(await screen.findByRole('status', { name: 'Connection status: Unreachable' })).toBeInTheDocument();
    expect(screen.getByText(/ALFI stays hidden on the dashboard/)).toBeInTheDocument();
    expect(screen.getByText('connection refused')).toBeInTheDocument();
  });

  it('reports an unreachable chat app', async () => {
    serveChat(true, 'error');
    renderCard();
    expect(await screen.findByRole('alert')).toHaveTextContent('could not be reached');
  });

  it('creates an Ollama block without a key and tests it', async () => {
    serveChat(true, null);
    let saved: Record<string, unknown> | null = null;
    let checked = '';
    server.use(
      http.put('*api/v1/chat/model-blocks/household-default', async ({ request }) => {
        saved = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json({ ...healthy, id: 'mb-new', provider_type: 'ollama', has_api_key: false }, { status: 201 });
      }),
      http.post('*api/v1/chat/model-blocks/:id/health-check', ({ params }) => {
        checked = String(params.id);
        return HttpResponse.json({ ...healthy, id: 'mb-new' });
      }),
    );
    renderCard('ADMIN');
    expect(await screen.findByText(/CHAT_ALLOWED_LLM_HOSTS/)).toBeInTheDocument();
    expect(screen.queryByLabelText('API key')).not.toBeInTheDocument();
    await userEvent.type(screen.getByLabelText('Base URL'), 'http://ollama.lan:11434');
    await userEvent.type(screen.getByLabelText('Model'), 'llama3.1:8b');
    await userEvent.click(screen.getByRole('button', { name: 'Save and test' }));
    await waitFor(() => expect(checked).toBe('mb-new'));
    expect(saved).toEqual({ display_name: '', provider_type: 'ollama', base_url: 'http://ollama.lan:11434', model_identifier: 'llama3.1:8b' });
  });

  it('explains CHAT_ALLOWED_LLM_HOSTS when chat rejects the host', async () => {
    serveChat(true, healthy);
    server.use(
      http.put('*api/v1/chat/model-blocks/household-default', () =>
        HttpResponse.json({ error: 'invalid_base_url', message: 'base_url is not an allowed destination' }, { status: 400 }),
      ),
    );
    renderCard();
    await userEvent.click(await screen.findByRole('button', { name: 'Save and test' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('add the host to CHAT_ALLOWED_LLM_HOSTS');
  });

  it('re-runs the health check', async () => {
    serveChat(true, healthy);
    let checked = false;
    server.use(
      http.post('*api/v1/chat/model-blocks/:id/health-check', () => {
        checked = true;
        return HttpResponse.json(healthy);
      }),
    );
    renderCard('MEMBER');
    await userEvent.click(await screen.findByRole('button', { name: 'Test connection' }));
    await waitFor(() => expect(checked).toBe(true));
  });
});
