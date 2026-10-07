"use client";

import { useCallback } from "react";
import { clearPendingForSession, flushQueue } from "@/features/offline_sync";
import { useAbandonSession } from "./useSessions";
import type { WorkoutSessionRead } from "../types";

/**
 * Abandon a session without losing what was already logged.
 *
 * Queued sets are pushed first (the confirmation promises logged sets are kept).
 * Whatever still could not be delivered is then discarded, since an abandoned
 * session rejects new sets and the entries would only fail on every retry.
 */
export function useAbandonSessionFlow() {
  const mutation = useAbandonSession();
  const { mutateAsync } = mutation;

  const abandonSession = useCallback(
    async (sessionId: string): Promise<WorkoutSessionRead> => {
      await flushQueue();
      const abandoned = await mutateAsync(sessionId);
      await clearPendingForSession(sessionId);
      return abandoned;
    },
    [mutateAsync]
  );

  return { abandonSession, isAbandoning: mutation.isPending };
}
