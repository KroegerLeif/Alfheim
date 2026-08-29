"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export interface RestTimerState {
  /** Seconds left, or null when no rest period is running. */
  secondsRemaining: number | null;
  isRunning: boolean;
  start: (seconds: number) => void;
  skip: () => void;
}

/**
 * Countdown for the rest period between sets.
 *
 * Ticks off a wall-clock deadline rather than decrementing a counter, so the
 * remaining time stays correct when the tab is backgrounded and the interval is
 * throttled — which is the normal case for a phone locked mid-set.
 */
export function useRestTimer(onComplete?: () => void): RestTimerState {
  const [deadline, setDeadline] = useState<number | null>(null);
  const [secondsRemaining, setSecondsRemaining] = useState<number | null>(null);
  const onCompleteRef = useRef(onComplete);

  useEffect(() => {
    onCompleteRef.current = onComplete;
  }, [onComplete]);

  useEffect(() => {
    if (deadline === null) {
      setSecondsRemaining(null);
      return;
    }

    const tick = () => {
      const remaining = Math.max(0, Math.ceil((deadline - Date.now()) / 1000));
      setSecondsRemaining(remaining);
      if (remaining === 0) {
        setDeadline(null);
        onCompleteRef.current?.();
      }
    };

    tick();
    const interval = setInterval(tick, 250);
    return () => clearInterval(interval);
  }, [deadline]);

  const start = useCallback((seconds: number) => {
    const safeSeconds = Math.max(0, Math.floor(seconds));
    setDeadline(safeSeconds === 0 ? null : Date.now() + safeSeconds * 1000);
  }, []);

  const skip = useCallback(() => setDeadline(null), []);

  return {
    secondsRemaining,
    isRunning: deadline !== null,
    start,
    skip,
  };
}
