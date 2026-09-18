/**
 * Active-household persistence, written exactly like the shared header
 * switcher (packages/shared/src/features/ui/hooks/useHouseholdSwitcher.ts):
 * the id goes to localStorage and a `storage-household-changed` event is
 * dispatched so every mounted switcher / app picks it up. Other tabs receive
 * the native `storage` event.
 */
export const ACTIVE_HOUSEHOLD_STORAGE_KEY = 'alfheim_active_household_id';
export const HOUSEHOLD_CHANGED_EVENT = 'storage-household-changed';

export function getActiveHouseholdId(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    return localStorage.getItem(ACTIVE_HOUSEHOLD_STORAGE_KEY);
  } catch {
    return null;
  }
}

export function setActiveHousehold(householdId: string): void {
  if (typeof window === 'undefined' || !householdId) return;
  try {
    localStorage.setItem(ACTIVE_HOUSEHOLD_STORAGE_KEY, householdId);
  } catch {
    // Storage unavailable (private mode / quota): nothing else to do.
  }
  window.dispatchEvent(new Event(HOUSEHOLD_CHANGED_EVENT));
}

/**
 * Clears the active household if it points at `householdId` (after leaving
 * or deleting it) and falls back to `fallbackId` when one is given.
 */
export function replaceActiveHousehold(householdId: string, fallbackId?: string | null): void {
  if (typeof window === 'undefined') return;
  if (getActiveHouseholdId() !== householdId) return;
  if (fallbackId) {
    setActiveHousehold(fallbackId);
    return;
  }
  try {
    localStorage.removeItem(ACTIVE_HOUSEHOLD_STORAGE_KEY);
  } catch {
    // ignore
  }
  window.dispatchEvent(new Event(HOUSEHOLD_CHANGED_EVENT));
}
