import type { AppItem } from '@/shared/types';

/** Registry ID of the chat app tile, ALFI's entry point on the dashboard. */
export const CHAT_APP_ID = 'chat';

/**
 * Leaves the chat tile out of the Tier-1 apps while ALFI has no healthy model block, so members
 * never open an assistant that cannot answer. Other tiles pass through unchanged.
 */
export function withoutUnreadyAlfi(apps: AppItem[] | undefined, alfiReady: boolean): AppItem[] | undefined {
  if (!apps || alfiReady) return apps;
  return apps.filter((app) => app.id !== CHAT_APP_ID);
}
