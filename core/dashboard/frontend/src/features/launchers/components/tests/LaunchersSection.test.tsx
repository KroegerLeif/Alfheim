import React from 'react';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';
import { StaticHouseholdProvider } from '@alfheim/shared';
import { server } from '../../../../tests/mocks/server';
import { renderWithProviders } from '../../../../tests/test-utils';
import { LaunchersSection } from '../LaunchersSection';
import type { Launcher } from '../../types';

const jellyfin: Launcher = {
  id: 'l-1',
  title: 'Jellyfin',
  url: 'https://jellyfin.home.example:8096/web',
  icon: 'clapperboard',
  description: 'Movies and shows',
  display_order: 0,
  created_at: '2026-11-23T00:00:00Z',
  updated_at: '2026-11-23T00:00:00Z',
};

function serveLaunchers(items: Launcher[] | null) {
  server.use(http.get('*api/v1/launchers', () => HttpResponse.json({ items, total: items?.length ?? 0, limit: 100, offset: 0 })));
}

function renderSection(role: string | null, householdId: string | null = 'hh-a') {
  return renderWithProviders(
    <StaticHouseholdProvider householdId={householdId} value={{ role }}>
      <LaunchersSection />
    </StaticHouseholdProvider>,
  );
}

describe('LaunchersSection', () => {
  it('shows a member the household launchers, opening in a new tab, without admin controls', async () => {
    serveLaunchers([jellyfin]);
    renderSection('MEMBER');

    const link = await screen.findByRole('link', { name: 'Open Jellyfin' });
    expect(link).toHaveAttribute('href', jellyfin.url);
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', 'noopener noreferrer');
    expect(screen.getByText('Movies and shows')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Add app link' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Edit Jellyfin' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Remove Jellyfin' })).not.toBeInTheDocument();
  });

  it('offers admins the add, edit and remove controls', async () => {
    serveLaunchers([jellyfin]);
    renderSection('ADMIN');

    expect(await screen.findByRole('button', { name: 'Edit Jellyfin' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Remove Jellyfin' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Add app link' })).toBeInTheDocument();
  });

  it('removes a launcher through the API', async () => {
    let deleted = '';
    serveLaunchers([jellyfin]);
    server.use(
      http.delete('*api/v1/launchers/:id', ({ params }) => {
        deleted = String(params.id);
        return new HttpResponse(null, { status: 204 });
      }),
    );
    renderSection('OWNER');

    await userEvent.click(await screen.findByRole('button', { name: 'Remove Jellyfin' }));
    await waitFor(() => expect(deleted).toBe('l-1'));
  });

  it('reports a failed removal', async () => {
    serveLaunchers([jellyfin]);
    server.use(http.delete('*api/v1/launchers/:id', () => HttpResponse.json({}, { status: 500 })));
    renderSection('OWNER');

    await userEvent.click(await screen.findByRole('button', { name: 'Remove Jellyfin' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('could not be removed');
  });

  it('opens the edit form for a launcher and closes it on cancel', async () => {
    serveLaunchers([jellyfin]);
    renderSection('ADMIN');

    await userEvent.click(await screen.findByRole('button', { name: 'Edit Jellyfin' }));
    const form = screen.getByRole('form', { name: 'Edit household app link' });
    expect(within(form).getByLabelText('Title')).toHaveValue('Jellyfin');
    expect(within(form).queryByLabelText('Preset')).not.toBeInTheDocument();
    await userEvent.click(within(form).getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByRole('form')).not.toBeInTheDocument();
  });

  it('explains the empty state per role', async () => {
    serveLaunchers(null);
    const { unmount } = renderSection('MEMBER');
    expect(await screen.findByText('Your household has no app links yet.')).toBeInTheDocument();
    unmount();

    renderSection('OWNER');
    expect(await screen.findByText(/Add links to the web apps/)).toBeInTheDocument();
  });

  it('shows a load error', async () => {
    server.use(http.get('*api/v1/launchers', () => HttpResponse.json({}, { status: 500 })));
    renderSection('MEMBER');
    expect(await screen.findByRole('alert')).toHaveTextContent('Could not load the household apps.');
  });

  it('asks for a household and hides admin controls without one', () => {
    renderSection(null, null);
    expect(screen.getByText('Choose a household to see its app links.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Add app link' })).not.toBeInTheDocument();
  });
});
