'use client';

import React, { useContext } from 'react';
import { HouseholdContext, type ActiveHouseholdContextValue } from './householdContext';
import { MY_HOUSEHOLDS_URL } from './householdApi';
import { ACTIVE_HOUSEHOLD_STORAGE_KEY, type Household } from './householdStore';
import { useHouseholdState } from './useHouseholdState';

export { HouseholdContext, type ActiveHouseholdContextValue, type HouseholdStatus } from './householdContext';

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
  const value = useHouseholdState({ householdsUrl, tokenRetries, tokenRetryDelayMs });
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
    } catch (error) {
      console.warn('Cannot store the test household in localStorage:', error);
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
