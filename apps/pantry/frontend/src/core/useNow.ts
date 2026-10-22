import { useSyncExternalStore } from "react";

const TICK_MS = 60_000;

let now = Date.now();
let timer: ReturnType<typeof setInterval> | undefined;
const listeners = new Set<() => void>();

function subscribe(listener: () => void): () => void {
  if (listeners.size === 0) {
    now = Date.now();
    timer = setInterval(() => {
      now = Date.now();
      listeners.forEach((notify) => notify());
    }, TICK_MS);
  }
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0) clearInterval(timer);
  };
}

const getSnapshot = () => now;

/**
 * The current time in milliseconds, refreshed once a minute. Reading the clock through this hook
 * keeps renders pure (no `Date.now()` in the render body) while expiry badges still move on.
 * All subscribers share one timer.
 */
export function useNow(): number {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}
