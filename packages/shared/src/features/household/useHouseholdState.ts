'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { fetchMyHouseholds } from './householdApi';
import type { ActiveHouseholdContextValue, HouseholdStatus } from './householdContext';
import {
  ACTIVE_HOUSEHOLD_STORAGE_KEY,
  HOUSEHOLD_CHANGED_EVENT,
  getActiveHouseholdId,
  isSelfDispatchedHouseholdEvent,
  pickActiveHousehold,
  readCachedHouseholds,
  setActiveHouseholdId,
  subscribeHouseholdErrors,
  writeCachedHouseholds,
  type Household,
  type HouseholdErrorReport,
} from './householdStore';

type FetchState = 'idle' | 'loaded' | 'error';

/** Options for {@link useHouseholdState}; mirrors the `HouseholdProvider` props. */
export interface HouseholdStateOptions {
  householdsUrl: string;
  tokenRetries: number;
  tokenRetryDelayMs: number;
}

/**
 * Loads the caller's memberships from core/household, tracks the active
 * household across tabs and collects backend household errors. Returns the
 * value a `HouseholdProvider` publishes.
 */
export function useHouseholdState({
  householdsUrl,
  tokenRetries,
  tokenRetryDelayMs,
}: HouseholdStateOptions): ActiveHouseholdContextValue {
  const [households, setHouseholds] = useState<Household[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [fetchState, setFetchState] = useState<FetchState>('idle');
  const [report, setReport] = useState<HouseholdErrorReport | null>(null);

  const householdsRef = useRef<Household[]>([]);
  const requestRef = useRef(0);
  const mountedRef = useRef(true);

  const applyHouseholds = useCallback((list: Household[]) => {
    householdsRef.current = list;
    setHouseholds(list);
  }, []);

  const load = useCallback(async () => {
    const requestId = ++requestRef.current;
    let result = await fetchMyHouseholds(householdsUrl);
    for (let i = 0; i < tokenRetries && !result.ok && result.reason === 'no_token'; i++) {
      await new Promise((resolve) => setTimeout(resolve, tokenRetryDelayMs));
      if (!mountedRef.current || requestId !== requestRef.current) return;
      result = await fetchMyHouseholds(householdsUrl);
    }
    if (!mountedRef.current || requestId !== requestRef.current) return;

    if (!result.ok) {
      // Keep working from a valid cache (e.g. brief outage); otherwise surface the error.
      setFetchState(householdsRef.current.length > 0 ? 'loaded' : 'error');
      return;
    }

    applyHouseholds(result.households);
    writeCachedHouseholds(result.households);
    const picked = pickActiveHousehold(result.households, getActiveHouseholdId());
    const nextId = picked?.id ?? null;
    setActiveHouseholdId(nextId);
    setActiveId(nextId);
    setFetchState('loaded');
  }, [applyHouseholds, householdsUrl, tokenRetries, tokenRetryDelayMs]);

  useEffect(() => {
    mountedRef.current = true;

    // Hydrate from cache after mount (SSR-safe) so the switcher renders instantly.
    const cached = readCachedHouseholds();
    const savedId = getActiveHouseholdId();
    if (cached.length > 0) applyHouseholds(cached);
    setActiveId(savedId);

    void load();

    const syncActiveId = (id: string | null, forceRefetch: boolean) => {
      setActiveId(id);
      const known = !id || householdsRef.current.some((h) => h.id === id);
      if (forceRefetch || !known) void load();
    };

    const handleStorage = (e: StorageEvent) => {
      if (e.key !== ACTIVE_HOUSEHOLD_STORAGE_KEY) return;
      syncActiveId(e.newValue || null, true);
    };
    const handleLocalChange = () => {
      // Our own writes only need a state sync; changes from other code (e.g. the
      // household app after creating/joining) may introduce a new membership.
      syncActiveId(getActiveHouseholdId(), !isSelfDispatchedHouseholdEvent());
    };
    const unsubscribeErrors = subscribeHouseholdErrors((r) => setReport(r));

    window.addEventListener('storage', handleStorage);
    window.addEventListener(HOUSEHOLD_CHANGED_EVENT, handleLocalChange);
    return () => {
      mountedRef.current = false;
      window.removeEventListener('storage', handleStorage);
      window.removeEventListener(HOUSEHOLD_CHANGED_EVENT, handleLocalChange);
      unsubscribeErrors();
    };
  }, [applyHouseholds, load]);

  const setActiveHousehold = useCallback((id: string) => {
    setReport(null);
    setActiveHouseholdId(id);
    setActiveId(id);
  }, []);

  const clearError = useCallback(() => setReport(null), []);

  const refetch = useCallback(async () => {
    setReport(null);
    await load();
  }, [load]);

  const value = useMemo<ActiveHouseholdContextValue>(() => {
    const household = households.find((h) => h.id === activeId) ?? null;
    let status: HouseholdStatus;
    if (household) status = 'ready';
    else if (fetchState === 'loaded' && households.length === 0) status = 'none';
    else if (fetchState === 'error') status = 'error';
    else status = 'loading';

    // A report only applies to the household it was raised for: switching clears it.
    const error = report && report.householdId === (household?.id ?? null) ? report.code : null;

    return {
      status,
      householdId: household?.id ?? null,
      role: household?.role ?? null,
      household,
      households,
      setActiveHousehold,
      refetch,
      error,
      clearError,
    };
  }, [activeId, clearError, fetchState, households, refetch, report, setActiveHousehold]);

  return value;
}
