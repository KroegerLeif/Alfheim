"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { listPendingForSession, useSyncQueue } from "@/features/offline_sync";
import { useAbandonSessionFlow } from "./useAbandonSessionFlow";
import { useCompleteSession, useSessionDetail } from "./useSessions";
import { useRestTimer } from "./useRestTimer";
import { firstOpenSetIndex, isSetCompleted, setSlotKey } from "../types";
import type { SessionExerciseRead, SessionSetRead } from "../types";

/** Default rest between sets, in seconds. */
export const DEFAULT_REST_SECONDS = 90;

export interface BerserkerCursor {
  exercise: SessionExerciseRead | null;
  set: SessionSetRead | null;
  setIndex: number;
}

/** Thrown by `finishSession` when sets are still waiting to reach the server. */
export class PendingSetsError extends Error {
  readonly count: number;

  constructor(count: number) {
    super(`${count} logged set(s) have not been synced yet.`);
    this.name = "PendingSetsError";
    this.count = count;
  }
}

/**
 * Drives the live-execution HUD: which set is up next, logging it through the
 * offline queue, and the rest countdown that follows.
 *
 * Logging goes to the queue first and the network second, so a set is never
 * lost to a dead connection in a basement gym. The cursor advances from locally
 * logged slots as well as server state, so the UI does not stall waiting for a
 * round trip. A slot is handed back to the user if its queued set is discarded
 * without ever reaching the server.
 */
export function useBerserkerSession(sessionId: string) {
  const { data: session, isLoading, isError } = useSessionDetail(sessionId);
  /** slot key -> client idempotency key of the queued set that covers that slot. */
  const [locallyLogged, setLocallyLogged] = useState<Map<string, string>>(new Map());
  const [isLogging, setIsLogging] = useState(false);
  const [logError, setLogError] = useState<unknown>(null);
  const restTimer = useRestTimer();
  const completeMutation = useCompleteSession();
  const { abandonSession, isAbandoning } = useAbandonSessionFlow();

  const releaseDropped = useCallback((droppedKeys: string[]) => {
    const dropped = new Set(droppedKeys);
    setLocallyLogged((previous) => {
      const next = new Map<string, string>();
      for (const [slot, key] of previous) {
        if (!dropped.has(key)) next.set(slot, key);
      }
      return next;
    });
  }, []);

  const syncQueue = useSyncQueue({ onDropped: releaseDropped });

  // A reload mid-workout leaves sets in the queue that the server has not seen
  // yet; treat their slots as done so they are not logged a second time.
  useEffect(() => {
    let cancelled = false;
    listPendingForSession(sessionId)
      .then((entries) => {
        if (cancelled || entries.length === 0) return;
        setLocallyLogged((previous) => {
          const next = new Map(previous);
          for (const entry of entries) {
            next.set(setSlotKey(entry.sessionExerciseId, entry.setOrder), entry.clientIdempotencyKey);
          }
          return next;
        });
      })
      .catch(() => {
        // An unreadable queue only means no slots are pre-marked; logging still works.
      });
    return () => {
      cancelled = true;
    };
  }, [sessionId]);

  const exercises = useMemo(() => session?.exercises ?? [], [session]);
  const isActive = session?.status === "active";

  const isSetDone = useCallback(
    (exercise: SessionExerciseRead, set: SessionSetRead) =>
      isSetCompleted(set) || locallyLogged.has(setSlotKey(exercise.id, set.set_order)),
    [locallyLogged]
  );

  /** First exercise with an unfinished set, and that set. */
  const cursor: BerserkerCursor = useMemo(() => {
    if (!isActive) return { exercise: null, set: null, setIndex: -1 };
    for (const exercise of exercises) {
      const sets = exercise.sets ?? [];
      const index = sets.findIndex((set) => !isSetDone(exercise, set));
      if (index !== -1) {
        return { exercise, set: sets[index], setIndex: index };
      }
    }
    return { exercise: null, set: null, setIndex: -1 };
  }, [exercises, isActive, isSetDone]);

  const isSessionFinished = isActive && exercises.length > 0 && cursor.set === null;

  const logActiveSet = useCallback(
    async (reps: number, weightKg: number) => {
      if (!cursor.exercise || !cursor.set) return;

      setIsLogging(true);
      setLogError(null);
      const slot = setSlotKey(cursor.exercise.id, cursor.set.set_order);
      try {
        const entry = await syncQueue.logSet({
          sessionId,
          sessionExerciseId: cursor.exercise.id,
          setOrder: cursor.set.set_order,
          actualReps: reps,
          actualWeightKg: weightKg,
          isWarmup: cursor.set.is_warmup,
        });
        // Advance immediately; the queue owns eventual delivery.
        setLocallyLogged((previous) => new Map(previous).set(slot, entry.clientIdempotencyKey));
        restTimer.start(DEFAULT_REST_SECONDS);
      } catch (error) {
        setLogError(error);
      } finally {
        setIsLogging(false);
      }
    },
    [cursor, sessionId, syncQueue, restTimer]
  );

  /**
   * Complete the session once every logged set has reached the server.
   * Throws PendingSetsError otherwise: a completed session rejects late sets,
   * so finishing with sets still queued would lose them.
   */
  const finishSession = useCallback(async () => {
    await syncQueue.flushNow();
    const stillPending = await listPendingForSession(sessionId);
    if (stillPending.length > 0) throw new PendingSetsError(stillPending.length);
    await completeMutation.mutateAsync(sessionId);
  }, [completeMutation, sessionId, syncQueue]);

  const abandon = useCallback(async () => {
    await abandonSession(sessionId);
  }, [abandonSession, sessionId]);

  return {
    session: session ?? null,
    exercises,
    cursor,
    isActive,
    isSessionFinished,
    isLoading,
    isError,
    isLogging,
    logError,
    logActiveSet,
    finishSession,
    isFinishing: completeMutation.isPending,
    abandonSession: abandon,
    isAbandoning,
    restTimer,
    syncQueue,
    firstOpenSetIndex,
  };
}
