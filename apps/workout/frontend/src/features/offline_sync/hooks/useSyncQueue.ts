"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { flushQueue, type FlushResult } from "../flush";
import { countPending, enqueueSet, type EnqueueInput } from "../queue";
import { isIndexedDbAvailable } from "../db";
import type { PendingSet, SyncQueueState } from "../types";

/** Background retry cadence while entries remain queued. */
const RETRY_INTERVAL_MS = 30_000;

export interface UseSyncQueueOptions {
  /** Called with the keys of sets that were permanently discarded by a flush. */
  onDropped?: (keys: string[]) => void;
}

export interface UseSyncQueueResult extends SyncQueueState {
  /** Persist a set locally and start a flush in the background. Resolves with the stored entry. */
  logSet: (input: EnqueueInput) => Promise<PendingSet>;
  /** Flush now and resolve with the outcome (null when the queue is unavailable). */
  flushNow: () => Promise<FlushResult | null>;
  /** Forget the dropped-set warning once the user has seen it. */
  dismissDropped: () => void;
}

/**
 * Owns the offline set-logging queue: persist first, sync second.
 *
 * Every logged set is written to IndexedDB before any request is attempted, so
 * a set survives a dead connection, a backgrounded tab, or a reload mid-workout.
 * Sets that are discarded without ever reaching the server are reported through
 * `droppedKeys` / `onDropped` instead of vanishing silently.
 */
export function useSyncQueue(options: UseSyncQueueOptions = {}): UseSyncQueueResult {
  const queryClient = useQueryClient();
  const [pendingCount, setPendingCount] = useState(0);
  const [activeFlushes, setActiveFlushes] = useState(0);
  const [lastError, setLastError] = useState<string | null>(null);
  const [isOnline, setIsOnline] = useState(true);
  const [droppedKeys, setDroppedKeys] = useState<string[]>([]);
  const onDroppedRef = useRef(options.onDropped);

  useEffect(() => {
    onDroppedRef.current = options.onDropped;
  }, [options.onDropped]);

  const refreshCount = useCallback(async () => {
    if (!isIndexedDbAvailable()) return;
    try {
      setPendingCount(await countPending());
    } catch {
      // A blocked or unavailable store must not break the UI.
    }
  }, []);

  const flushNow = useCallback(async (): Promise<FlushResult | null> => {
    if (!isIndexedDbAvailable()) return null;

    setActiveFlushes((count) => count + 1);
    try {
      const result = await flushQueue();
      setLastError(result.error);
      setPendingCount(result.remainingCount);

      if (result.droppedKeys.length > 0) {
        setDroppedKeys((previous) => [...previous, ...result.droppedKeys]);
        onDroppedRef.current?.(result.droppedKeys);
      }
      if (result.ackedCount > 0 || result.droppedKeys.length > 0) {
        // Server state changed (or a set must be offered again); let session views refetch.
        queryClient.invalidateQueries({ queryKey: ["sessions"] });
      }
      return result;
    } catch (err) {
      setLastError(err instanceof Error ? err.message : String(err));
      return null;
    } finally {
      setActiveFlushes((count) => count - 1);
    }
  }, [queryClient]);

  const logSet = useCallback(
    async (input: EnqueueInput) => {
      const entry = await enqueueSet(input);
      await refreshCount();
      // Sync in the background: the set is already safe on this device, so the
      // HUD must not wait on the network before advancing to the next set.
      void flushNow();
      return entry;
    },
    [flushNow, refreshCount]
  );

  const dismissDropped = useCallback(() => setDroppedKeys([]), []);

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

  return {
    pendingCount,
    isSyncing: activeFlushes > 0,
    isOnline,
    lastError,
    droppedKeys,
    logSet,
    flushNow,
    dismissDropped,
  };
}
