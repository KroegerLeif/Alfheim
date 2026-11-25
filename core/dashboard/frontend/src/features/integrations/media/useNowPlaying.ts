import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useActiveHousehold } from '@alfheim/shared';
import { fetchNowPlaying, sendMediaCommand } from './mediaApi';
import type { MediaCommand, NowPlaying } from './types';

const NOW_PLAYING_KEY = 'media-now-playing';

/** How often the widget refreshes what is playing. */
export const NOW_PLAYING_REFRESH_MS = 15_000;

/** Roles that may control playback; the backend enforces the same set. */
const CONTROL_ROLES = ['OWNER', 'ADMIN', 'MEMBER'];

/** Now playing of the active household, refreshed while the dashboard is open. */
export function useNowPlaying() {
  const { householdId, status } = useActiveHousehold();
  return useQuery<NowPlaying>({
    queryKey: [NOW_PLAYING_KEY, householdId],
    queryFn: fetchNowPlaying,
    enabled: status === 'ready',
    refetchInterval: NOW_PLAYING_REFRESH_MS,
  });
}

/** Whether the caller's household role may send playback commands; it only hides UI. */
export function useCanControlMedia(): boolean {
  const { role, status } = useActiveHousehold();
  return status === 'ready' && !!role && CONTROL_ROLES.includes(role.toUpperCase());
}

interface CommandVars {
  source: string;
  sessionId: string;
  command: MediaCommand;
}

/** Sends one playback command and refreshes now playing. */
export function useMediaCommand() {
  const queryClient = useQueryClient();
  const { householdId } = useActiveHousehold();
  return useMutation<void, Error, CommandVars>({
    mutationFn: ({ source, sessionId, command }) => sendMediaCommand(source, sessionId, command),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [NOW_PLAYING_KEY, householdId] }),
  });
}
