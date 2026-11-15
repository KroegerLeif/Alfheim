'use client';

import { createContext } from 'react';
import type { Household, HouseholdErrorCode } from './householdStore';

/** Lifecycle of the active-household lookup. */
export type HouseholdStatus = 'loading' | 'none' | 'ready' | 'error';

/** Value published by `HouseholdProvider` and read by `useActiveHousehold`. */
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

/** React context carrying the active household; `null` outside a provider. */
export const HouseholdContext = createContext<ActiveHouseholdContextValue | null>(null);
