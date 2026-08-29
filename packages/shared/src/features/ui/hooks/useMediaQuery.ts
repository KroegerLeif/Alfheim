"use client";

import { useEffect, useState } from "react";

/**
 * Subscribe to a CSS media query.
 *
 * Returns `false` during SSR and on the first client render, then settles to
 * the real value in an effect. That deliberate false-on-first-render keeps
 * server and client markup identical, so layout that depends on this must
 * degrade gracefully rather than flash — prefer Tailwind breakpoint classes
 * for pure styling and reserve this hook for behavior that CSS cannot express.
 */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
      return;
    }

    const mediaQueryList = window.matchMedia(query);
    setMatches(mediaQueryList.matches);

    const handleChange = (event: MediaQueryListEvent) => setMatches(event.matches);
    mediaQueryList.addEventListener("change", handleChange);
    return () => mediaQueryList.removeEventListener("change", handleChange);
  }, [query]);

  return matches;
}

/** Tailwind's `md` breakpoint. True from 768px up. */
export const MD_BREAKPOINT_QUERY = "(min-width: 768px)";

/** Convenience wrapper: true on tablet and desktop, false on phones. */
export function useIsDesktop(): boolean {
  return useMediaQuery(MD_BREAKPOINT_QUERY);
}
