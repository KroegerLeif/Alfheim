import { ApiError } from "@/core/api";
import { syncSets } from "./api/syncApi";
import { isIndexedDbAvailable } from "./db";
import {
  discardEntries,
  groupBySession,
  listPending,
  recordFailedAttempt,
} from "./queue";
import { toSyncItem } from "./types";

/** Backend error code for a batch aimed at a completed or abandoned session. */
export const SESSION_NOT_ACTIVE_CODE = "session_not_active";

export interface FlushResult {
  ackedCount: number;
  /** Entries still queued after this flush (transient failures + unacked items). */
  remainingCount: number;
  /** Keys discarded without reaching the server: retries exhausted or session no longer active. */
  droppedKeys: string[];
  /** First transport error encountered, if any. */
  error: string | null;
}

const EMPTY_RESULT: FlushResult = { ackedCount: 0, remainingCount: 0, droppedKeys: [], error: null };

/**
 * Drain the pending queue, one request per session.
 *
 * Only keys the backend explicitly acknowledges are deleted. Anything else —
 * a network failure, or an item the backend skipped because its
 * session_exercise_id is not on that session — has its attempt counter
 * incremented and is eventually dropped, so the queue cannot grow unbounded or
 * pin the pending badge forever. A `session_not_active` rejection can never
 * succeed on retry, so that session's entries are dropped immediately.
 */
async function drainQueue(): Promise<FlushResult> {
  if (!isIndexedDbAvailable()) return EMPTY_RESULT;

  const pending = await listPending();
  if (pending.length === 0) return EMPTY_RESULT;

  const bySession = groupBySession(pending);
  let ackedCount = 0;
  const droppedKeys: string[] = [];
  let error: string | null = null;

  for (const [sessionId, entries] of bySession) {
    const keys = entries.map((entry) => entry.clientIdempotencyKey);

    try {
      const response = await syncSets(sessionId, entries.map(toSyncItem));
      const acked = response?.acked ?? [];

      await discardEntries(acked);
      ackedCount += acked.length;

      const unacked = keys.filter((key) => !acked.includes(key));
      droppedKeys.push(...(await recordFailedAttempt(unacked)));
    } catch (err) {
      if (err instanceof ApiError && err.code === SESSION_NOT_ACTIVE_CODE) {
        await discardEntries(keys);
        droppedKeys.push(...keys);
        continue;
      }
      // Transport-level failure: nothing in this batch reached the server, so
      // count one attempt against every key and retry on the next flush.
      error = error ?? (err instanceof Error ? err.message : String(err));
      droppedKeys.push(...(await recordFailedAttempt(keys)));
    }
  }

  const remaining = await listPending();
  return { ackedCount, remainingCount: remaining.length, droppedKeys, error };
}

let flushChain: Promise<unknown> = Promise.resolve();

/**
 * Run a drain after any flush already in progress.
 *
 * Flushes are serialized process-wide (the session HUD, the abandon flow and the
 * retry timer all call this), so the same batch is never in flight twice and a
 * caller that awaits the result sees the state after its own entries were handled.
 */
export function flushQueue(): Promise<FlushResult> {
  const run = flushChain.then(drainQueue, drainQueue);
  flushChain = run.catch(() => undefined);
  return run;
}
