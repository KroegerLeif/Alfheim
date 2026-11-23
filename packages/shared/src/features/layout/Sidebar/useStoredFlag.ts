"use client";

import { useCallback, useSyncExternalStore } from "react";

// `storage` only fires in other tabs, so writes from this tab announce themselves with this event.
const LOCAL_FLAG_EVENT = "alfheim:stored-flag";

function subscribe(onChange: () => void): () => void {
  window.addEventListener("storage", onChange);
  window.addEventListener(LOCAL_FLAG_EVENT, onChange);
  return () => {
    window.removeEventListener("storage", onChange);
    window.removeEventListener(LOCAL_FLAG_EVENT, onChange);
  };
}

/**
 * A boolean persisted in `localStorage` under `key`.
 *
 * Renders `fallback` on the server and during hydration, then the stored value, so server and
 * client markup match. Every component reading the same key re-renders when it changes.
 */
export function useStoredFlag(key: string, fallback = false): [boolean, (next: boolean) => void] {
  const getSnapshot = useCallback(() => {
    const stored = localStorage.getItem(key);
    return stored === null ? fallback : stored === "true";
  }, [key, fallback]);
  const getServerSnapshot = useCallback(() => fallback, [fallback]);

  const value = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  const setValue = useCallback(
    (next: boolean) => {
      localStorage.setItem(key, String(next));
      window.dispatchEvent(new Event(LOCAL_FLAG_EVENT));
    },
    [key],
  );

  return [value, setValue];
}
