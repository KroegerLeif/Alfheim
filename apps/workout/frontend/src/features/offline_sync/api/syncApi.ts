import { workoutClient } from "@/core/api";
import type { SessionSetSyncItem, SessionSetSyncResponse } from "../types";

/**
 * Push a batch of locally logged sets for one session.
 *
 * The endpoint is an upsert keyed on client_idempotency_key, so replaying a
 * batch that partially landed is safe: already-stored keys come back in `acked`
 * without creating duplicate rows.
 */
export function syncSets(
  sessionId: string,
  items: SessionSetSyncItem[]
): Promise<SessionSetSyncResponse> {
  return workoutClient
    .post(`api/v1/sessions/${sessionId}/sets/sync`, { json: { items: items ?? [] } })
    .json<SessionSetSyncResponse>();
}
