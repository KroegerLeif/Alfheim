"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { flushQueue } from "../flush";
import { countPending, enqueueSet, type EnqueueInput } from "../queue";
import { isIndexedDbAvailable } from "../db";
import type { SyncQueueState } from "../types";

/** Background retry cadence while entries remain queued. */
const RETRY_INTERVAL_MS = 30_000;

export interface UseSyncQueueResult extends SyncQueueState {
  /** Persist a set locally, then attempt an immediate flush. */
  logSet: (input: EnqueueInput) => Promise<void>;
  /** Force a flush now (e.g. from a retry button). */
  flushNow: () => Promise<void>;
}

/**
 * Owns the offline set-logging queue: persist first, sync second.
 *
 * Every logged set is written to IndexedDB before any request is attempted, so
 * a set survives a dead connection, a backgrounded tab, or a reload mid-workout.
 */
export function useSyncQueue(): UseSyncQueueResult {
  const queryClient = useQueryClient();
  const [pendingCount, setPendingCount] = useState(0);
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastError, setLastError] = useState<string | null>(null);
  const [isOnline, setIsOnline] = useState(true);
  const isFlushingRef = useRef(false);

  const refreshCount = useCallback(async () => {
    if (!isIndexedDbAvailable()) return;
    try {
      setPendingCount(await countPending());
    } catch {
      // A blocked or unavailable store must not break the UI.
    }
  }, []);

  const flushNow = useCallback(async () => {
    if (!isIndexedDbAvailable()) return;
    // Guard against overlapping flushes double-sending the same batch.
    if (isFlushingRef.current) return;

    isFlushingRef.current = true;
    setIsSyncing(true);
    try {
      const result = await flushQueue();
      setLastError(result.error);
      setPendingCount(result.remainingCount);

      if (result.ackedCount > 0) {
        // Server state changed; let session views refetch.
        queryClient.invalidateQueries({ queryKey: ["sessions"] });
      }
    } catch (err) {
      setLastError(err instanceof Error ? err.message : String(err));
    } finally {
      isFlushingRef.current = false;
      setIsSyncing(false);
    }
  }, [queryClient]);

  const logSet = useCallback(
    async (input: EnqueueInput) => {
      await enqueueSet(input);
      await refreshCount();
      await flushNow();
    },
    [flushNow, refreshCount]
  );

  useEffect(() => {
    if (typeof window === "undefined") return;

    setIsOnline(navigator.onLine);
    void refreshCount();

    const handleOnline = () => {
      setIsOnline(true);
      void flushNow();
    };
    const handleOffline = () => setIsOnline(false);

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    const interval = setInterval(() => {
      if (navigator.onLine) void flushNow();
    }, RETRY_INTERVAL_MS);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      clearInterval(interval);
    };
  }, [flushNow, refreshCount]);

  return { pendingCount, isSyncing, isOnline, lastError, logSet, flushNow };
}
