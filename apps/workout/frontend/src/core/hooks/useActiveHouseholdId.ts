"use client";

import { useEffect, useState } from "react";

const STORAGE_KEY = "alfheim_active_household_id";

/**
 * Read the active household id written by the shared HouseholdSwitcher.
 *
 * Reacts to both the native `storage` event (switch made in another tab) and
 * the `storage-household-changed` custom event the switcher dispatches in the
 * current tab, since `storage` does not fire for same-document writes.
 *
 * Every query key in this app is scoped by the returned id so that switching
 * households cannot serve another tenant's cached data.
 */
export function useActiveHouseholdId(): string | null {
  const [activeId, setActiveId] = useState<string | null>(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem(STORAGE_KEY);
    }
    return null;
  });

  useEffect(() => {
    setActiveId(localStorage.getItem(STORAGE_KEY));

    const handleStorageChange = (event: StorageEvent) => {
      if (event.key === STORAGE_KEY) {
        setActiveId(event.newValue);
      }
    };

    const handleLocalChange = () => {
      setActiveId(localStorage.getItem(STORAGE_KEY));
    };

    window.addEventListener("storage", handleStorageChange);
    window.addEventListener("storage-household-changed", handleLocalChange);

    return () => {
      window.removeEventListener("storage", handleStorageChange);
      window.removeEventListener("storage-household-changed", handleLocalChange);
    };
  }, []);

  return activeId;
}
