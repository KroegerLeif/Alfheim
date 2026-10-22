import { useCallback, useSyncExternalStore } from "react";

/** localStorage key of the parts cart that the maintenance wizard and the shopping view share. */
export const CART_STORAGE_KEY = "cart_maintenance-frontend";

const EMPTY_CART: string[] = [];
const listeners = new Set<() => void>();

/** Serialized cart that could not be persisted (storage blocked or full); it keeps the cart usable in memory. */
let unsavedRaw: string | undefined;
let snapshotRaw: string | null | undefined;
let snapshot: string[] = EMPTY_CART;

function readRaw(): string | null {
  if (unsavedRaw !== undefined) return unsavedRaw;
  try {
    return localStorage.getItem(CART_STORAGE_KEY);
  } catch (error) {
    console.warn("Ignoring unreadable maintenance cart in localStorage:", error);
    return null;
  }
}

function parseCart(raw: string | null): string[] {
  if (!raw) return EMPTY_CART;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return EMPTY_CART;
    // Drop foreign entries and duplicates so list keys stay unique.
    return Array.from(new Set(parsed.filter((item): item is string => typeof item === "string")));
  } catch (error) {
    console.warn("Ignoring unreadable maintenance cart in localStorage:", error);
    return EMPTY_CART;
  }
}

/** Referentially stable between changes of the stored value, as useSyncExternalStore requires. */
function getSnapshot(): string[] {
  const raw = readRaw();
  if (raw !== snapshotRaw) {
    snapshotRaw = raw;
    snapshot = parseCart(raw);
  }
  return snapshot;
}

function getServerSnapshot(): string[] {
  return EMPTY_CART;
}

function subscribe(onChange: () => void): () => void {
  const onStorage = (event: StorageEvent) => {
    if (event.key === CART_STORAGE_KEY || event.key === null) {
      unsavedRaw = undefined;
      onChange();
    }
  };
  listeners.add(onChange);
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(onChange);
    window.removeEventListener("storage", onStorage);
  };
}

function writeCart(items: string[]): void {
  const raw = JSON.stringify(items);
  try {
    localStorage.setItem(CART_STORAGE_KEY, raw);
    unsavedRaw = undefined;
  } catch (error) {
    console.warn("Could not persist the maintenance cart to localStorage:", error);
    unsavedRaw = raw;
  }
  listeners.forEach((listener) => listener());
}

/** The parts cart persisted in localStorage. The server render shows an empty cart so server and client markup match. */
export function useCart() {
  const cart = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  const replace = useCallback((items: string[]) => writeCart(items), []);

  const remove = useCallback((item: string) => replace(cart.filter((entry) => entry !== item)), [cart, replace]);
  const toggle = useCallback(
    (item: string) => replace(cart.includes(item) ? cart.filter((entry) => entry !== item) : [...cart, item]),
    [cart, replace],
  );
  const clear = useCallback(() => replace([]), [replace]);

  return { cart, replace, remove, toggle, clear };
}
