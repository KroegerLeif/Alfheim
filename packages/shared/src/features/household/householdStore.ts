/**
 * Framework-free household context primitives shared by every Alfheim frontend.
 *
 * The active household id lives in `localStorage` under
 * `alfheim_active_household_id`; every change is announced with the
 * `storage-household-changed` window event (same tab) and the native `storage`
 * event (other tabs). API clients are module-level singletons that cannot use
 * React hooks, so they read the id through {@link getActiveHouseholdId} /
 * {@link householdHeaders} and report household errors through
 * {@link reportHouseholdErrorResponse}; the React {@link HouseholdProvider}
 * builds on the same primitives.
 */

export const ACTIVE_HOUSEHOLD_STORAGE_KEY = 'alfheim_active_household_id';
export const HOUSEHOLD_CHANGED_EVENT = 'storage-household-changed';
export const HOUSEHOLDS_CACHE_KEY = 'alfheim_cached_households';
export const LEGACY_HOUSEHOLDS_CACHE_KEY = 'loeger_os_cached_households';
export const HOUSEHOLD_ID_HEADER = 'X-Household-ID';

/** Household app URLs (a separate Next app, so always full-page navigation). */
export const HOUSEHOLD_APP_URLS = {
  manage: '/household',
  onboarding: '/household/onboarding',
  join: '/household/join',
} as const;

export interface Household {
  id: string;
  name: string;
  slug?: string;
  role?: string | null;
  is_default?: boolean;
}

// ---------------------------------------------------------------------------
// Active household id
// ---------------------------------------------------------------------------

let selfDispatchDepth = 0;

/** True while {@link setActiveHouseholdId} is dispatching its own change event. */
export function isSelfDispatchedHouseholdEvent(): boolean {
  return selfDispatchDepth > 0;
}

export function getActiveHouseholdId(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    return localStorage.getItem(ACTIVE_HOUSEHOLD_STORAGE_KEY) || null;
  } catch {
    return null;
  }
}

function dispatchHouseholdChanged(): void {
  selfDispatchDepth += 1;
  try {
    window.dispatchEvent(new Event(HOUSEHOLD_CHANGED_EVENT));
  } finally {
    selfDispatchDepth -= 1;
  }
}

/**
 * Persists the active household (or clears it with `null`) and notifies every
 * listener in this tab. No-op when the value does not change, so listeners that
 * react to the event by writing again cannot loop.
 */
export function setActiveHouseholdId(id: string | null): void {
  if (typeof window === 'undefined') return;
  if (getActiveHouseholdId() === (id || null)) return;
  try {
    if (id) localStorage.setItem(ACTIVE_HOUSEHOLD_STORAGE_KEY, id);
    else localStorage.removeItem(ACTIVE_HOUSEHOLD_STORAGE_KEY);
  } catch {
    // Storage unavailable (private mode / quota): listeners still re-read.
  }
  dispatchHouseholdChanged();
}

/**
 * Headers for a household-scoped API call. Only `X-Household-ID` is ever sent:
 * roles are resolved server-side by core/household, never claimed by clients.
 */
export function householdHeaders(
  householdId: string | null | undefined = getActiveHouseholdId(),
): Record<string, string> {
  return householdId ? { [HOUSEHOLD_ID_HEADER]: householdId } : {};
}

/** Sets (or removes) the household header on a mutable `Headers` instance. */
export function applyHouseholdHeaders(
  headers: Headers,
  householdId: string | null | undefined = getActiveHouseholdId(),
): Headers {
  headers.delete('X-Household-Role');
  if (householdId) headers.set(HOUSEHOLD_ID_HEADER, householdId);
  else headers.delete(HOUSEHOLD_ID_HEADER);
  return headers;
}

// ---------------------------------------------------------------------------
// Household error contract
// ---------------------------------------------------------------------------

export const HOUSEHOLD_ERROR_CODES = [
  'household_required',
  'household_invalid',
  'household_forbidden',
  'household_role_forbidden',
  'household_service_unavailable',
] as const;

export type HouseholdErrorCode = (typeof HOUSEHOLD_ERROR_CODES)[number];

export function isHouseholdErrorCode(value: unknown): value is HouseholdErrorCode {
  return typeof value === 'string' && (HOUSEHOLD_ERROR_CODES as readonly string[]).includes(value);
}

/**
 * Extracts the household error code from a backend error body
 * (`{"detail":{"code":..., "message":...}}`). Returns `null` for anything else.
 */
export function getHouseholdErrorCode(body: unknown): HouseholdErrorCode | null {
  if (!body || typeof body !== 'object') return null;
  const detail = (body as { detail?: unknown }).detail;
  if (detail && typeof detail === 'object') {
    const code = (detail as { code?: unknown }).code;
    if (isHouseholdErrorCode(code)) return code;
  }
  const code = (body as { code?: unknown }).code;
  return isHouseholdErrorCode(code) ? code : null;
}

/**
 * Normalizes a backend error body into `{ code, message }`. Handles the
 * structured contract (`{"detail":{"code","message"}}`) as well as plain
 * FastAPI `{"detail": "..."}` and `{"message": "..."}` bodies.
 */
export function parseApiErrorBody(body: unknown): { code: string | null; message: string | null } {
  if (!body || typeof body !== 'object') return { code: null, message: null };
  const { detail, message, code } = body as { detail?: unknown; message?: unknown; code?: unknown };
  if (typeof detail === 'string') return { code: typeof code === 'string' ? code : null, message: detail };
  if (detail && typeof detail === 'object') {
    const d = detail as { code?: unknown; message?: unknown };
    return {
      code: typeof d.code === 'string' ? d.code : null,
      message: typeof d.message === 'string' ? d.message : typeof message === 'string' ? message : null,
    };
  }
  return { code: typeof code === 'string' ? code : null, message: typeof message === 'string' ? message : null };
}

/** Reads the household error code from a `Response` without consuming it. */
export async function readHouseholdErrorCode(response: Response): Promise<HouseholdErrorCode | null> {
  if (response.ok || ![400, 403, 503].includes(response.status)) return null;
  try {
    const body = await response.clone().json();
    return getHouseholdErrorCode(body);
  } catch {
    return null;
  }
}

/**
 * Error codes that mean "this household cannot be used here": the gate offers
 * onboarding and switching instead of the page content.
 */
export function isHouseholdAccessError(code: HouseholdErrorCode | null | undefined): boolean {
  return code === 'household_required' || code === 'household_invalid' || code === 'household_forbidden';
}

export interface HouseholdErrorReport {
  code: HouseholdErrorCode;
  householdId: string | null;
}

type HouseholdErrorListener = (report: HouseholdErrorReport) => void;
const errorListeners = new Set<HouseholdErrorListener>();

export function subscribeHouseholdErrors(listener: HouseholdErrorListener): () => void {
  errorListeners.add(listener);
  return () => {
    errorListeners.delete(listener);
  };
}

/** Broadcasts a household error to the mounted provider (and its gate). */
export function reportHouseholdError(
  code: HouseholdErrorCode,
  householdId: string | null = getActiveHouseholdId(),
): void {
  errorListeners.forEach((listener) => listener({ code, householdId }));
}

/**
 * `afterResponse`-style helper for API clients: when the response carries a
 * household error code it is reported to the provider. `household_role_forbidden`
 * is left to the calling UI (the household itself is fine, only the action is
 * not allowed). Returns the code so callers can map it to their own messages.
 */
export async function reportHouseholdErrorResponse(
  response: Response,
  householdId: string | null = getActiveHouseholdId(),
): Promise<HouseholdErrorCode | null> {
  const code = await readHouseholdErrorCode(response);
  if (code && code !== 'household_role_forbidden') reportHouseholdError(code, householdId);
  return code;
}

// ---------------------------------------------------------------------------
// Cached household list
// ---------------------------------------------------------------------------

export function readCachedHouseholds(): Household[] {
  if (typeof window === 'undefined') return [];
  try {
    const cached =
      localStorage.getItem(HOUSEHOLDS_CACHE_KEY) || localStorage.getItem(LEGACY_HOUSEHOLDS_CACHE_KEY);
    if (!cached) return [];
    const parsed = JSON.parse(cached);
    return Array.isArray(parsed) ? parsed.filter(isHousehold) : [];
  } catch {
    return [];
  }
}

export function writeCachedHouseholds(households: Household[]): void {
  try {
    const serialized = JSON.stringify(households);
    localStorage.setItem(HOUSEHOLDS_CACHE_KEY, serialized);
    localStorage.setItem(LEGACY_HOUSEHOLDS_CACHE_KEY, serialized);
  } catch {
    // Ignore storage quota errors
  }
}

export function isHousehold(value: unknown): value is Household {
  return (
    !!value &&
    typeof value === 'object' &&
    typeof (value as Household).id === 'string' &&
    typeof (value as Household).name === 'string'
  );
}

/** Saved id when it is still a membership, else the default household, else the first. */
export function pickActiveHousehold(households: Household[], savedId: string | null): Household | null {
  if (households.length === 0) return null;
  return (
    households.find((h) => h.id === savedId) ||
    households.find((h) => h.is_default) ||
    households[0]
  );
}
