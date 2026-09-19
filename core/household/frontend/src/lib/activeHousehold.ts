/**
 * Active-household persistence for the household app, delegating to the
 * shared store in @alfheim/shared (the same one the header switcher and every
 * app's HouseholdProvider use): the id goes to localStorage under
 * `alfheim_active_household_id` and a `storage-household-changed` event is
 * dispatched; other tabs receive the native `storage` event.
 */
import {
  ACTIVE_HOUSEHOLD_STORAGE_KEY,
  HOUSEHOLD_CHANGED_EVENT,
  getActiveHouseholdId,
  setActiveHouseholdId,
} from '@alfheim/shared';

export { ACTIVE_HOUSEHOLD_STORAGE_KEY, HOUSEHOLD_CHANGED_EVENT, getActiveHouseholdId };

/**
 * Tells mounted HouseholdProviders that the membership list changed (create,
 * join, leave, delete, new default) so they reload `/api/v1/households/me`.
 */
export function notifyHouseholdsChanged(): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new Event(HOUSEHOLD_CHANGED_EVENT));
}

/** Makes `householdId` the active household for every Alfheim app. */
export function setActiveHousehold(householdId: string): void {
  if (typeof window === 'undefined' || !householdId) return;
  if (getActiveHouseholdId() === householdId) return;
  setActiveHouseholdId(householdId);
}

/**
 * After leaving or deleting `householdId`: clears it as the active household
 * (falling back to `fallbackId` when given) and refreshes the membership list.
 */
export function replaceActiveHousehold(householdId: string, fallbackId?: string | null): void {
  if (typeof window === 'undefined') return;
  if (getActiveHouseholdId() === householdId) {
    setActiveHouseholdId(fallbackId || null);
  }
  notifyHouseholdsChanged();
}
