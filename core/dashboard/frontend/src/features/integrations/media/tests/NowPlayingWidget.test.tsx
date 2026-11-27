import React from 'react';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';
import { StaticHouseholdProvider } from '@alfheim/shared';
import { server } from '../../../../tests/mocks/server';
import { renderWithProviders } from '../../../../tests/test-utils';
import { NowPlayingWidget } from '../NowPlayingWidget';
import type { NowPlaying } from '../types';

const playing: NowPlaying = {
  items: [
    { source: 'jellyfin', session_id: 's1', title: 'Film', artist: '', device: 'TV', state: 'paused', can_control: true },
    { source: 'navidrome', session_id: '3', title: 'Song', artist: 'Band', device: 'Kitchen', state: 'playing', can_control: false },
  ],
  sources: [
    { source: 'jellyfin', status: 'ok' },
    { source: 'navidrome', status: 'ok' },
  ],
};

function serveNowPlaying(body: NowPlaying) {
  server.use(http.get('*api/v1/integrations/media/now-playing', () => HttpResponse.json(body)));
}

function renderWidget(role = 'MEMBER') {
  return renderWithProviders(
    <StaticHouseholdProvider householdId="hh-a" value={{ role }}>
      <NowPlayingWidget />
    </StaticHouseholdProvider>,
  );
}

describe('NowPlayingWidget', () => {
  it('stays hidden while no media server is enabled', async () => {
    let called = false;
    server.use(
      http.get('*api/v1/integrations/media/now-playing', () => {
        called = true;
        return HttpResponse.json({ items: null, sources: null });
      }),
    );
    const { container } = renderWidget();
    await waitFor(() => expect(called).toBe(true));
    expect(container).toBeEmptyDOMElement();
  });

  it('lists sessions and offers control only where the server supports it', async () => {
    serveNowPlaying(playing);
    renderWidget();
    expect(await screen.findByText('Film')).toBeInTheDocument();
    expect(screen.getByText('Paused on TV')).toBeInTheDocument();
    expect(screen.getByText('Playing on Kitchen')).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: 'Play' })).toHaveLength(1);
    expect(screen.queryByRole('button', { name: 'Pause' })).not.toBeInTheDocument();
  });

  it('sends a playback command for the session', async () => {
    serveNowPlaying(playing);
    let sent = '';
    server.use(
      http.post('*api/v1/integrations/media/:type/sessions/:id/:command', ({ params }) => {
        sent = `${params.type}/${params.id}/${params.command}`;
        return new HttpResponse(null, { status: 204 });
      }),
    );
    renderWidget('ADMIN');
    await userEvent.click(await screen.findByRole('button', { name: 'Next' }));
    await waitFor(() => expect(sent).toBe('jellyfin/s1/next'));
  });

  it('reports a rejected command and failed servers', async () => {
    serveNowPlaying({ items: playing.items, sources: [{ source: 'jellyfin', status: 'ok' }, { source: 'navidrome', status: 'auth_failed' }] });
    server.use(http.post('*api/v1/integrations/media/:type/sessions/:id/:command', () => HttpResponse.json({}, { status: 502 })));
    renderWidget();
    expect(await screen.findByText('Navidrome could not be read: Sign-in failed')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Stop' }));
    expect(await screen.findByText(/did not accept the command/)).toBeInTheDocument();
  });

  it('says so when an enabled server plays nothing', async () => {
    serveNowPlaying({ items: [], sources: [{ source: 'jellyfin', status: 'ok' }] });
    renderWidget('GUEST');
    expect(await screen.findByText('Nothing is playing right now.')).toBeInTheDocument();
  });

  it('hides the controls from guests', async () => {
    serveNowPlaying(playing);
    renderWidget('GUEST');
    expect(await screen.findByText('Film')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Play' })).not.toBeInTheDocument();
  });
});
