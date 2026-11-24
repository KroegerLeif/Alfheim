import React from 'react';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';
import { StaticHouseholdProvider } from '@alfheim/shared';
import { server } from '../../../../tests/mocks/server';
import { renderWithProviders } from '../../../../tests/test-utils';
import { PluginCard } from '../PluginCard';
import { testPluginView } from '../../tests/fixtures';
import type { Plugin, PluginFormProps, PluginUiEntry } from '../../types';

function TestForm({ onSubmit, encryptionAvailable }: PluginFormProps) {
  return (
    <button type="button" data-encryption={String(encryptionAvailable)} onClick={() => onSubmit({ enabled: true, base_url: 'https://new', config: {}, credentials: { token: 't' } })}>
      submit-form
    </button>
  );
}

const entry: PluginUiEntry = { titleKey: 'dashboard.integrations.title', Form: TestForm };

function renderCard(plugin: Plugin, canManage: boolean, withEntry = true) {
  return renderWithProviders(
    <StaticHouseholdProvider householdId="hh-a" value={{ role: canManage ? 'ADMIN' : 'MEMBER' }}>
      <PluginCard plugin={plugin} entry={withEntry ? entry : undefined} canManage={canManage} encryptionAvailable />
    </StaticHouseholdProvider>,
  );
}

describe('PluginCard', () => {
  it('shows members the status and credential indicator without edit controls', () => {
    renderCard(testPluginView, false);
    expect(screen.getByRole('status', { name: 'Connection status: Connected' })).toBeInTheDocument();
    expect(screen.getByText('Credentials stored')).toBeInTheDocument();
    expect(screen.getByText('connected')).toBeInTheDocument();
    expect(screen.queryByRole('switch')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Test connection' })).not.toBeInTheDocument();
    expect(screen.queryByText('submit-form')).not.toBeInTheDocument();
  });

  it('falls back to the type id and the generic shell without a registry entry', () => {
    renderCard({ ...testPluginView, has_credentials: false, health: { status: 'weird', detail: '', checked_at: null } }, true, false);
    expect(screen.getByRole('heading', { name: 'testdouble' })).toBeInTheDocument();
    expect(screen.getByText('No credentials stored')).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveAttribute('data-health', 'error');
    expect(screen.queryByText('submit-form')).not.toBeInTheDocument();
  });

  it('toggles the plugin without sending credentials', async () => {
    let body: unknown = null;
    server.use(
      http.put('*api/v1/integrations/plugins/:type', async ({ request }) => {
        body = await request.json();
        return HttpResponse.json(testPluginView);
      }),
    );
    renderCard(testPluginView, true);
    await userEvent.click(screen.getByRole('switch', { name: 'Enable Integrations' }));
    await waitFor(() => expect(body).toEqual({ enabled: false, base_url: 'https://ha.example.com', config: { mode: 'x' } }));
  });

  it('hands the form slot an onSubmit that saves the plugin', async () => {
    let body: Record<string, unknown> | null = null;
    server.use(
      http.put('*api/v1/integrations/plugins/:type', async ({ request }) => {
        body = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json(testPluginView);
      }),
    );
    renderCard(testPluginView, true);
    expect(screen.getByText('submit-form')).toHaveAttribute('data-encryption', 'true');
    await userEvent.click(screen.getByText('submit-form'));
    await waitFor(() => expect(body?.credentials).toEqual({ token: 't' }));
  });

  it('runs the connection test', async () => {
    let tested = '';
    server.use(
      http.post('*api/v1/integrations/plugins/:type/test', ({ params }) => {
        tested = String(params.type);
        return HttpResponse.json(testPluginView);
      }),
    );
    renderCard(testPluginView, true);
    await userEvent.click(screen.getByRole('button', { name: 'Test connection' }));
    await waitFor(() => expect(tested).toBe('testdouble'));
  });

  it('disables the test until the plugin is configured', () => {
    renderCard({ ...testPluginView, configured: false }, true);
    expect(screen.getByRole('button', { name: 'Test connection' })).toBeDisabled();
  });

  it.each([
    [422, 'some values are not valid'],
    [403, 'Only household owners and admins'],
    [503, 'no encryption key'],
    [500, 'could not be updated'],
  ])('reports a failed save with status %i', async (status, text) => {
    server.use(http.put('*api/v1/integrations/plugins/:type', () => HttpResponse.json({}, { status })));
    renderCard(testPluginView, true);
    await userEvent.click(screen.getByText('submit-form'));
    expect(await screen.findByRole('alert')).toHaveTextContent(text);
  });

  it('reports a failed test', async () => {
    server.use(http.post('*api/v1/integrations/plugins/:type/test', () => HttpResponse.json({}, { status: 404 })));
    renderCard(testPluginView, true);
    await userEvent.click(screen.getByRole('button', { name: 'Test connection' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('could not be updated');
  });
});
