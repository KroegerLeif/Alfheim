import { useCallback, useEffect, useState } from "react";

/** localStorage key of the parts cart that the maintenance wizard and the shopping view share. */
export const CART_STORAGE_KEY = "cart_maintenance-frontend";

function readCart(): string[] {
  try {
    const raw = localStorage.getItem(CART_STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    // Drop foreign entries and duplicates so list keys stay unique.
    return Array.from(new Set(parsed.filter((item): item is string => typeof item === "string")));
  } catch (error) {
    console.warn("Ignoring unreadable maintenance cart in localStorage:", error);
    return [];
  }
}

function writeCart(items: string[]): void {
  try {
    localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(items));
  } catch (error) {
    console.warn("Could not persist the maintenance cart to localStorage:", error);
  }
}

/** The parts cart persisted in localStorage. It is read after mount so server and client markup match. */
export function useCart() {
  const [cart, setCart] = useState<string[]>([]);

  useEffect(() => {
    setCart(readCart());
  }, []);

  const replace = useCallback((items: string[]) => {
    setCart(items);
    writeCart(items);
  }, []);

  const remove = useCallback((item: string) => replace(cart.filter((entry) => entry !== item)), [cart, replace]);
  const toggle = useCallback(
    (item: string) => replace(cart.includes(item) ? cart.filter((entry) => entry !== item) : [...cart, item]),
    [cart, replace],
  );
  const clear = useCallback(() => replace([]), [replace]);

  return { cart, replace, remove, toggle, clear };
}
