'use client';

import { Pause, Play, SkipBack, SkipForward, Square, type LucideIcon } from 'lucide-react';
import { useTranslation } from '@alfheim/shared';
import type { MediaCommand, MediaStatus } from './types';

interface NowPlayingItemProps {
  item: MediaStatus;
  /** Whether the caller's role may control playback; the session must also allow it. */
  canControl: boolean;
  busy: boolean;
  onCommand: (command: MediaCommand) => void;
}

/** One playing session with its playback controls, if the server and the role allow them. */
export function NowPlayingItem({ item, canControl, busy, onCommand }: NowPlayingItemProps) {
  const { t } = useTranslation();
  const controls: Array<{ command: MediaCommand; icon: LucideIcon; labelKey: string }> = [
    { command: 'previous', icon: SkipBack, labelKey: 'dashboard.integrations.media.previous' },
    {
      command: 'play_pause',
      icon: item.state === 'paused' ? Play : Pause,
      labelKey: item.state === 'paused' ? 'dashboard.integrations.media.play' : 'dashboard.integrations.media.pause',
    },
    { command: 'next', icon: SkipForward, labelKey: 'dashboard.integrations.media.next' },
    { command: 'stop', icon: Square, labelKey: 'dashboard.integrations.media.stop' },
  ];

  return (
    <li className="p-4 rounded-xl bg-[var(--surface-card)] border border-[var(--border-subtle)] flex flex-col gap-2 min-w-0">
      <div className="min-w-0">
        <p className="text-sm font-semibold text-[var(--text-main)] truncate">{item.title}</p>
        {item.artist && <p className="text-xs text-[var(--text-muted)] truncate">{item.artist}</p>}
      </div>
      <p className="text-[11px] font-mono text-[var(--text-muted)] truncate">
        {t(item.state === 'paused' ? 'dashboard.integrations.media.paused_on' : 'dashboard.integrations.media.playing_on', {
          device: item.device || item.source,
        })}
      </p>
      {canControl && item.can_control && (
        <div className="flex items-center gap-1.5">
          {controls.map(({ command, icon: Icon, labelKey }) => (
            <button
              key={command}
              type="button"
              disabled={busy}
              onClick={() => onCommand(command)}
              aria-label={t(labelKey)}
              title={t(labelKey)}
              className="p-1.5 rounded-lg border border-[var(--border-subtle)] text-[var(--text-main)] hover:border-[var(--primary-main)]/50 disabled:opacity-50"
            >
              <Icon className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
          ))}
        </div>
      )}
    </li>
  );
}
