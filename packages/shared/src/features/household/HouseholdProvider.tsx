'use client';

import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { fetchMyHouseholds, MY_HOUSEHOLDS_URL } from './householdApi';
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
  type HouseholdErrorCode,
  type HouseholdErrorReport,
} from './householdStore';

export type HouseholdStatus = 'loading' | 'none' | 'ready' | 'error';

export interface ActiveHouseholdContextValue {
  /** `ready` only when an active household is known to be one of the caller's memberships. */
  status: HouseholdStatus;
  householdId: string | null;
  /** Caller's role in the active household as reported by core/household (display only). */
  role: string | null;
  household: Household | null;
  households: Household[];
  setActiveHousehold: (id: string) => void;
  /** Reloads the membership list from core/household. */
  refetch: () => Promise<void>;
  /** Household error a backend reported for the active household (see `reportHouseholdError`). */
  error: HouseholdErrorCode | null;
  clearError: () => void;
}

export const HouseholdContext = createContext<ActiveHouseholdContextValue | null>(null);

type FetchState = 'idle' | 'loaded' | 'error';

export interface HouseholdProviderProps {
  children: React.ReactNode;
  /** Override for tests; defaults to `/api/v1/households/me`. */
  householdsUrl?: string;
  /** How often to retry while the OIDC token is not available yet. */
  tokenRetries?: number;
  tokenRetryDelayMs?: number;
}

function StandaloneHouseholdProvider({
  children,
  householdsUrl = MY_HOUSEHOLDS_URL,
  tokenRetries = 10,
  tokenRetryDelayMs = 300,
}: HouseholdProviderProps) {
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

  return <HouseholdContext.Provider value={value}>{children}</HouseholdContext.Provider>;
}

/**
 * Owns the active-household state for an app. Nested providers are
 * pass-through, so it is safe to mount it in the shared `AppShell` and again
 * around a component that needs it standalone.
 */
export function HouseholdProvider(props: HouseholdProviderProps) {
  const parent = useContext(HouseholdContext);
  if (parent) return <>{props.children}</>;
  return <StandaloneHouseholdProvider {...props} />;
}

/** Active household context; requires a `HouseholdProvider` (the shared `AppShell` mounts one). */
export function useActiveHousehold(): ActiveHouseholdContextValue {
  const ctx = useContext(HouseholdContext);
  if (!ctx) {
    throw new Error('useActiveHousehold must be used within a HouseholdProvider (mounted by AppShell).');
  }
  return ctx;
}

/** Like {@link useActiveHousehold} but returns `null` outside a provider. */
export function useOptionalActiveHousehold(): ActiveHouseholdContextValue | null {
  return useContext(HouseholdContext);
}

export interface StaticHouseholdProviderProps {
  children: React.ReactNode;
  /** Active household id; `null` yields status `none` unless `value.status` is given. */
  householdId?: string | null;
  value?: Partial<ActiveHouseholdContextValue>;
}

/**
 * Fixed household context without fetching, for tests and previews. Writes
 * the id to storage so API clients using `householdHeaders()` see it too.
 */
export function StaticHouseholdProvider({ children, householdId = 'hh-test', value }: StaticHouseholdProviderProps) {
  if (typeof window !== 'undefined') {
    try {
      if (householdId) localStorage.setItem(ACTIVE_HOUSEHOLD_STORAGE_KEY, householdId);
      else localStorage.removeItem(ACTIVE_HOUSEHOLD_STORAGE_KEY);
    } catch {
      // ignore
    }
  }
  const household: Household | null = householdId ? { id: householdId, name: 'Test Household', role: 'OWNER' } : null;
  const ctx: ActiveHouseholdContextValue = {
    status: householdId ? 'ready' : 'none',
    householdId,
    role: household?.role ?? null,
    household,
    households: household ? [household] : [],
    setActiveHousehold: () => {},
    refetch: async () => {},
    error: null,
    clearError: () => {},
    ...value,
  };
  return <HouseholdContext.Provider value={ctx}>{children}</HouseholdContext.Provider>;
}
