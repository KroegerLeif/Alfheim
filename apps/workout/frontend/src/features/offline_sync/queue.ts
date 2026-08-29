import { getDb, PENDING_SETS_STORE, SESSION_INDEX } from "./db";
import type { PendingSet } from "./types";

/**
 * Entries that never get acknowledged are dropped after this many flushes.
 *
 * The backend deliberately skips (rather than rejects) sync items whose
 * session_exercise_id is not on the session, so a malformed or stale entry
 * would otherwise be retried forever and permanently pin the pending badge.
 */
export const MAX_SYNC_ATTEMPTS = 5;

export interface EnqueueInput {
  sessionId: string;
  sessionExerciseId: string;
  setOrder: number;
  actualReps: number | null;
  actualWeightKg: number | null;
  isWarmup?: boolean;
  completedAt?: string;
  /** Injectable for deterministic tests; defaults to crypto.randomUUID(). */
  clientIdempotencyKey?: string;
  queuedAt?: number;
}

function newKey(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `set-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

/** Persist a locally logged set. Returns the stored entry, including its key. */
export async function enqueueSet(input: EnqueueInput): Promise<PendingSet> {
  const entry: PendingSet = {
    clientIdempotencyKey: input.clientIdempotencyKey ?? newKey(),
    sessionId: input.sessionId,
    sessionExerciseId: input.sessionExerciseId,
    setOrder: input.setOrder,
    actualReps: input.actualReps,
    actualWeightKg: input.actualWeightKg,
    isWarmup: input.isWarmup ?? false,
    completedAt: input.completedAt ?? new Date().toISOString(),
    queuedAt: input.queuedAt ?? Date.now(),
    attempts: 0,
  };

  const db = await getDb();
  // put(), not add(): re-logging the same key must overwrite rather than throw,
  // mirroring the idempotent semantics of the backend endpoint.
  await db.put(PENDING_SETS_STORE, entry);
  return entry;
}

/** All pending entries, oldest first. */
export async function listPending(): Promise<PendingSet[]> {
  const db = await getDb();
  const entries = (await db.getAll(PENDING_SETS_STORE)) ?? [];
  return entries.sort((a, b) => a.queuedAt - b.queuedAt);
}

/** Pending entries for one session, oldest first. */
export async function listPendingForSession(sessionId: string): Promise<PendingSet[]> {
  const db = await getDb();
  const entries = (await db.getAllFromIndex(PENDING_SETS_STORE, SESSION_INDEX, sessionId)) ?? [];
  return entries.sort((a, b) => a.queuedAt - b.queuedAt);
}

export async function countPending(): Promise<number> {
  const db = await getDb();
  return db.count(PENDING_SETS_STORE);
}

/** Remove entries the backend acknowledged. Safe to call with unknown keys. */
export async function removeAcked(keys: string[]): Promise<void> {
  const safeKeys = keys ?? [];
  if (safeKeys.length === 0) return;

  const db = await getDb();
  const tx = db.transaction(PENDING_SETS_STORE, "readwrite");
  await Promise.all(safeKeys.map((key) => tx.store.delete(key)));
  await tx.done;
}

/**
 * Increment the attempt counter for entries that survived a flush unacked, and
 * drop any that have now exhausted MAX_SYNC_ATTEMPTS.
 *
 * Returns the keys that were dropped so the caller can surface them.
 */
export async function recordFailedAttempt(keys: string[]): Promise<string[]> {
  const safeKeys = keys ?? [];
  if (safeKeys.length === 0) return [];

  const db = await getDb();
  const tx = db.transaction(PENDING_SETS_STORE, "readwrite");
  const dropped: string[] = [];

  for (const key of safeKeys) {
    const entry = await tx.store.get(key);
    if (!entry) continue;

    const attempts = entry.attempts + 1;
    if (attempts >= MAX_SYNC_ATTEMPTS) {
      await tx.store.delete(key);
      dropped.push(key);
    } else {
      await tx.store.put({ ...entry, attempts });
    }
  }

  await tx.done;
  return dropped;
}

/** Remove every pending entry. Used on logout and in tests. */
export async function clearQueue(): Promise<void> {
  const db = await getDb();
  await db.clear(PENDING_SETS_STORE);
}

/** Group pending entries by session so each flush is one request per session. */
export function groupBySession(entries: PendingSet[]): Map<string, PendingSet[]> {
  const grouped = new Map<string, PendingSet[]>();
  for (const entry of entries ?? []) {
    const bucket = grouped.get(entry.sessionId);
    if (bucket) {
      bucket.push(entry);
    } else {
      grouped.set(entry.sessionId, [entry]);
    }
  }
  return grouped;
}
