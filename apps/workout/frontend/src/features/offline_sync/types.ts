/**
 * A set logged locally that has not yet been acknowledged by the backend.
 *
 * `clientIdempotencyKey` is generated on this device and is the primary key
 * both here and in the backend's partial unique index on
 * (session_exercise_id, client_idempotency_key). Re-sending the same key is a
 * no-op server-side, which is what makes replaying the queue safe.
 */
export interface PendingSet {
  clientIdempotencyKey: string;
  sessionId: string;
  sessionExerciseId: string;
  setOrder: number;
  actualReps: number | null;
  actualWeightKg: number | null;
  isWarmup: boolean;
  completedAt: string;
  /** Epoch millis, used only for FIFO ordering of a flush batch. */
  queuedAt: number;
  /** Incremented per failed flush; entries are dropped past MAX_SYNC_ATTEMPTS. */
  attempts: number;
}

/** Wire shape of one item in `POST /sessions/{id}/sets/sync`. */
export interface SessionSetSyncItem {
  client_idempotency_key: string;
  session_exercise_id: string;
  set_order: number;
  actual_reps: number | null;
  actual_weight_kg: number | null;
  is_warmup: boolean;
  completed_at: string | null;
}

export interface SessionSetSyncResponse {
  acked: string[];
  server_ids: Record<string, string>;
}

export interface SyncQueueState {
  pendingCount: number;
  isSyncing: boolean;
  isOnline: boolean;
  lastError: string | null;
}

export function toSyncItem(entry: PendingSet): SessionSetSyncItem {
  return {
    client_idempotency_key: entry.clientIdempotencyKey,
    session_exercise_id: entry.sessionExerciseId,
    set_order: entry.setOrder,
    actual_reps: entry.actualReps,
    actual_weight_kg: entry.actualWeightKg,
    is_warmup: entry.isWarmup,
    completed_at: entry.completedAt,
  };
}
