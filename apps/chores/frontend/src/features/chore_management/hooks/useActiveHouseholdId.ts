import { useState, useEffect } from "react";

export function useActiveHouseholdId() {
  const [activeId, setActiveId] = useState<string | null>(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("alfheim_active_household_id");
    }
    return null;
  });

  useEffect(() => {
    setActiveId(localStorage.getItem("alfheim_active_household_id"));

    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === "alfheim_active_household_id") {
        setActiveId(e.newValue);
      }
    };

    const handleLocalChange = () => {
      setActiveId(localStorage.getItem("alfheim_active_household_id"));
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
