"use client";

import { useCallback, useSyncExternalStore } from "react";

function supportsMatchMedia(): boolean {
  return typeof window !== "undefined" && typeof window.matchMedia === "function";
}

function getServerSnapshot(): boolean {
  return false;
}

/**
 * Subscribe to a CSS media query.
 *
 * Returns `false` during SSR and hydration, then the real value. Keeping the server snapshot
 * `false` keeps server and client markup identical, so layout that depends on this must degrade
 * gracefully rather than flash. Prefer Tailwind breakpoint classes for pure styling and reserve
 * this hook for behavior that CSS cannot express.
 */
export function useMediaQuery(query: string): boolean {
  const subscribe = useCallback(
    (onChange: () => void) => {
      if (!supportsMatchMedia()) return () => {};
      const mediaQueryList = window.matchMedia(query);
      mediaQueryList.addEventListener("change", onChange);
      return () => mediaQueryList.removeEventListener("change", onChange);
    },
    [query],
  );
  const getSnapshot = useCallback(
    () => supportsMatchMedia() && window.matchMedia(query).matches,
    [query],
  );
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

/** Tailwind's `md` breakpoint. True from 768px up. */
export const MD_BREAKPOINT_QUERY = "(min-width: 768px)";

/** Convenience wrapper: true on tablet and desktop, false on phones. */
export function useIsDesktop(): boolean {
  return useMediaQuery(MD_BREAKPOINT_QUERY);
}
