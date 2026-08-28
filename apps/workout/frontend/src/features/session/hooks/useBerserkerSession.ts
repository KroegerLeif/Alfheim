"use client";

import { useCallback, useMemo, useState } from "react";
import { useSyncQueue } from "@/features/offline_sync";
import { useCompleteSession, useSessionDetail } from "./useSessions";
import { useRestTimer } from "./useRestTimer";
import { firstOpenSetIndex, isSetCompleted } from "../types";
import type { SessionExerciseRead, SessionSetRead } from "../types";

/** Default rest between sets, in seconds. */
export const DEFAULT_REST_SECONDS = 90;

export interface BerserkerCursor {
  exercise: SessionExerciseRead | null;
  set: SessionSetRead | null;
  setIndex: number;
}

/**
 * Drives the live-execution HUD: which set is up next, logging it through the
 * offline queue, and the rest countdown that follows.
 *
 * Logging goes to the queue first and the network second, so a set is never
 * lost to a dead connection in a basement gym. The cursor advances from locally
 * logged keys as well as server state, so the UI does not stall waiting for a
 * round trip.
 */
export function useBerserkerSession(sessionId: string) {
  const { data: session, isLoading, isError } = useSessionDetail(sessionId);
  const syncQueue = useSyncQueue();
  const completeMutation = useCompleteSession();
  const [locallyLogged, setLocallyLogged] = useState<Set<string>>(new Set());
  const [isLogging, setIsLogging] = useState(false);
  const restTimer = useRestTimer();

  const exercises = useMemo(() => session?.exercises ?? [], [session]);

  const isSetDone = useCallback(
    (set: SessionSetRead) => isSetCompleted(set) || locallyLogged.has(set.id),
    [locallyLogged]
  );

  /** First exercise with an unfinished set, and that set. */
  const cursor: BerserkerCursor = useMemo(() => {
    for (const exercise of exercises) {
      const sets = exercise.sets ?? [];
      const index = sets.findIndex((set) => !isSetDone(set));
      if (index !== -1) {
        return { exercise, set: sets[index], setIndex: index };
      }
    }
    return { exercise: null, set: null, setIndex: -1 };
  }, [exercises, isSetDone]);

  const isSessionFinished = exercises.length > 0 && cursor.set === null;

  const logActiveSet = useCallback(
    async (reps: number, weightKg: number) => {
      if (!cursor.exercise || !cursor.set) return;

      setIsLogging(true);
      const setId = cursor.set.id;
      try {
        await syncQueue.logSet({
          sessionId,
          sessionExerciseId: cursor.exercise.id,
          setOrder: cursor.set.set_order,
          actualReps: reps,
          actualWeightKg: weightKg,
          isWarmup: cursor.set.is_warmup,
        });
        // Advance immediately; the queue owns eventual delivery.
        setLocallyLogged((prev) => new Set(prev).add(setId));
        restTimer.start(DEFAULT_REST_SECONDS);
      } finally {
        setIsLogging(false);
      }
    },
    [cursor, sessionId, syncQueue, restTimer]
  );

  const finishSession = useCallback(async () => {
    // Drain anything still queued before closing the session, so a completed
    // session is not missing its last sets.
    await syncQueue.flushNow();
    await completeMutation.mutateAsync(sessionId);
  }, [completeMutation, sessionId, syncQueue]);

  return {
    session: session ?? null,
    exercises,
    cursor,
    isSessionFinished,
    isLoading,
    isError,
    isLogging,
    logActiveSet,
    finishSession,
    isFinishing: completeMutation.isPending,
    restTimer,
    syncQueue,
    firstOpenSetIndex,
  };
}
