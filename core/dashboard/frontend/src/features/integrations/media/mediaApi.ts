import { api } from '@/core/api/client';
import type { MediaCommand, NowPlaying } from './types';

/** What the household's enabled media servers play right now; media itself is never proxied. */
export async function fetchNowPlaying(): Promise<NowPlaying> {
  const body = await api.get('integrations/media/now-playing').json<NowPlaying>();
  return { items: body.items ?? [], sources: body.sources ?? [] };
}

/** Sends a playback command to one session (OWNER, ADMIN and MEMBER). */
export async function sendMediaCommand(source: string, sessionId: string, command: MediaCommand): Promise<void> {
  const segments = [source, 'sessions', sessionId, command].map(encodeURIComponent).join('/');
  await api.post(`integrations/media/${segments}`);
}
