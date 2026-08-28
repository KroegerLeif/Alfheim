import { syncSets } from "./api/syncApi";
import { groupBySession, listPending, recordFailedAttempt, removeAcked } from "./queue";
import { toSyncItem } from "./types";

export interface FlushResult {
  ackedCount: number;
  /** Entries still queued after this flush (transient failures + unacked items). */
  remainingCount: number;
  /** Keys discarded after exhausting MAX_SYNC_ATTEMPTS. */
  droppedKeys: string[];
  /** First transport error encountered, if any. */
  error: string | null;
}

/**
 * Drain the pending queue, one request per session.
 *
 * Only keys the backend explicitly acknowledges are deleted. Anything else —
 * a network failure, or an item the backend skipped because its
 * session_exercise_id is not on that session — has its attempt counter
 * incremented and is eventually dropped, so the queue cannot grow unbounded or
 * pin the pending badge forever.
 */
export async function flushQueue(): Promise<FlushResult> {
  const pending = await listPending();
  if (pending.length === 0) {
    return { ackedCount: 0, remainingCount: 0, droppedKeys: [], error: null };
  }

  const bySession = groupBySession(pending);
  let ackedCount = 0;
  const droppedKeys: string[] = [];
  let error: string | null = null;

  for (const [sessionId, entries] of bySession) {
    const keys = entries.map((entry) => entry.clientIdempotencyKey);

    try {
      const response = await syncSets(sessionId, entries.map(toSyncItem));
      const acked = response?.acked ?? [];

      await removeAcked(acked);
      ackedCount += acked.length;

      const unacked = keys.filter((key) => !acked.includes(key));
      droppedKeys.push(...(await recordFailedAttempt(unacked)));
    } catch (err) {
      // Transport-level failure: nothing in this batch reached the server, so
      // count one attempt against every key and retry on the next flush.
      error = error ?? (err instanceof Error ? err.message : String(err));
      droppedKeys.push(...(await recordFailedAttempt(keys)));
    }
  }

  const remaining = await listPending();
  return { ackedCount, remainingCount: remaining.length, droppedKeys, error };
}
