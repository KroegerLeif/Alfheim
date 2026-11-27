'use client';

import { useState } from 'react';
import { Music } from 'lucide-react';
import { useTranslation } from '@alfheim/shared';
import { knownHealthStatus } from '../errors';
import { NowPlayingItem } from './NowPlayingItem';
import { useCanControlMedia, useMediaCommand, useNowPlaying } from './useNowPlaying';
import type { MediaCommand, MediaStatus } from './types';

/** Display names of the media server types, by plugin type. */
const SOURCE_NAME_KEYS: Record<string, string> = {
  jellyfin: 'dashboard.integrations.media.jellyfin',
  navidrome: 'dashboard.integrations.media.navidrome',
};

/**
 * What the household's LAN media servers play right now, with playback control where the server
 * supports it. Hidden while no media server is enabled. Only status and control calls go through
 * Alfheim; the media stream stays between the player and the server.
 */
export function NowPlayingWidget() {
  const { t } = useTranslation();
  const { data } = useNowPlaying();
  const canControl = useCanControlMedia();
  const command = useMediaCommand();
  const [failed, setFailed] = useState(false);
  const sources = data?.sources ?? [];
  const items = data?.items ?? [];
  if (sources.length === 0) return null;

  const sourceName = (source: string) => (SOURCE_NAME_KEYS[source] ? t(SOURCE_NAME_KEYS[source]) : source);
  const send = (item: MediaStatus, cmd: MediaCommand) => {
    setFailed(false);
    command.mutate({ source: item.source, sessionId: item.session_id, command: cmd }, { onError: () => setFailed(true) });
  };

  return (
    <section className="col-span-12 mt-2" aria-labelledby="now-playing-heading">
      <div className="flex items-center gap-2 mb-3">
        <Music className="h-5 w-5 text-[var(--primary-main)]" aria-hidden="true" />
        <h2 id="now-playing-heading" className="text-lg font-bold text-[var(--text-main)]">
          {t('dashboard.integrations.media.now_playing')}
        </h2>
      </div>
      {sources
        .filter((s) => s.status !== 'ok')
        .map((s) => (
          <p key={s.source} role="alert" className="mb-2 text-xs text-red-400">
            {t('dashboard.integrations.media.source_failed', {
              name: sourceName(s.source),
              status: t(`dashboard.integrations.status.${knownHealthStatus(s.status)}`),
            })}
          </p>
        ))}
      {failed && (
        <p role="alert" className="mb-2 text-xs text-red-400">
          {t('dashboard.integrations.media.command_failed')}
        </p>
      )}
      {items.length === 0 ? (
        <p className="p-4 rounded-xl bg-[var(--surface-card)] border border-dashed border-[var(--border-subtle)] text-xs text-[var(--text-muted)] text-center">
          {t('dashboard.integrations.media.nothing_playing')}
        </p>
      ) : (
        <ul className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
          {items.map((item) => (
            <NowPlayingItem
              key={`${item.source}:${item.session_id}`}
              item={item}
              canControl={canControl}
              busy={command.isPending}
              onCommand={(cmd) => send(item, cmd)}
            />
          ))}
        </ul>
      )}
    </section>
  );
}
