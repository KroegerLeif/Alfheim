import React from 'react';
import { screen } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';
import { StaticHouseholdProvider } from '@alfheim/shared';
import { server } from '../../../../tests/mocks/server';
import { renderWithProviders } from '../../../../tests/test-utils';
import { IntegrationsSection } from '../IntegrationsSection';
import { servePlugins, testPluginView } from '../../tests/fixtures';

function renderSection(role: string | null, householdId: string | null = 'hh-a') {
  return renderWithProviders(
    <StaticHouseholdProvider householdId={householdId} value={{ role }}>
      <IntegrationsSection registry={{}} />
    </StaticHouseholdProvider>,
  );
}

describe('IntegrationsSection', () => {
  it('lists the plugin cards', async () => {
    servePlugins([testPluginView]);
    renderSection('MEMBER');
    expect(await screen.findByRole('article', { name: 'testdouble' })).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('explains an empty build', async () => {
    servePlugins(null);
    renderSection('OWNER');
    expect(await screen.findByText('No integrations are available in this version yet.')).toBeInTheDocument();
  });

  it('warns admins, and only admins, when credentials cannot be encrypted', async () => {
    servePlugins([testPluginView], false);
    const { unmount } = renderSection('ADMIN');
    expect(await screen.findByRole('alert')).toHaveTextContent('INTEGRATIONS_ENCRYPTION_KEY');
    unmount();

    renderSection('MEMBER');
    await screen.findByRole('article', { name: 'testdouble' });
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('shows a load error', async () => {
    server.use(http.get('*api/v1/integrations/plugins', () => HttpResponse.json({}, { status: 500 })));
    renderSection('MEMBER');
    expect(await screen.findByRole('alert')).toHaveTextContent('Could not load the integrations.');
  });

  it('asks for a household without one', () => {
    renderSection(null, null);
    expect(screen.getByText('Choose a household to see its integrations.')).toBeInTheDocument();
  });
});
