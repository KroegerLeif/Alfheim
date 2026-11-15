'use client';

import { useEffect, useRef } from 'react';

/**
 * Calls `clear` once `ms` milliseconds after `value` became set (anything but `null`,
 * `undefined`, `false` or `''`), for flash and toast messages that hide themselves.
 *
 * The timer lives in an effect, so it restarts when `value` changes and is cancelled when the
 * component unmounts: the state update never lands on an unmounted component or after a test
 * environment has been torn down (#647). `clear` may change between renders; the latest one runs.
 */
export function useAutoClear<T>(value: T, clear: () => void, ms: number): void {
  const clearRef = useRef(clear);
  useEffect(() => {
    clearRef.current = clear;
  });

  const isSet = value !== null && value !== undefined && value !== false && value !== '';
  useEffect(() => {
    if (!isSet) return;
    const timer = setTimeout(() => clearRef.current(), ms);
    return () => clearTimeout(timer);
  }, [isSet, value, ms]);
}
