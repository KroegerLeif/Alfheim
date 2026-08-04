"use client";

import React, { createContext, useContext, useState, ReactNode } from "react";

export type NavOption = "devices" | "maintenance" | "scheduled" | "history" | "shopping";

interface LayoutContextType {
  activeNav: NavOption;
  setActiveNav: (nav: NavOption) => void;
  householdId: number | null | undefined;
  setHouseholdId: (id: number | null) => void;
  isSidebarCollapsed: boolean;
  setIsSidebarCollapsed: (collapsed: boolean) => void;
}

const LayoutContext = createContext<LayoutContextType | undefined>(undefined);

export function LayoutProvider({ children }: { children: ReactNode }) {
  const [activeNav, setActiveNav] = useState<NavOption>("devices");
  const [householdIdState, setHouseholdIdState] = useState<number | string | null | undefined>(undefined);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

  // Load from localStorage on mount
  React.useEffect(() => {
    const saved = localStorage.getItem("loeger_os_active_household_id");
    if (saved !== null) {
      setHouseholdIdState(saved);
    } else {
      setHouseholdIdState(null); // explicitly set to null if not found
    }
  }, []);

  const setHouseholdId = (id: number | null) => {
    if (id === null) {
      localStorage.removeItem("loeger_os_active_household_id");
    } else {
      localStorage.setItem("loeger_os_active_household_id", id.toString());
    }
    setHouseholdIdState(id);
    window.dispatchEvent(new Event("storage-household-changed"));
  };

  // Safely parse string/UUID IDs into integer numbers for Maintenance views
  const householdId = React.useMemo(() => {
    if (householdIdState === null) return null;
    if (householdIdState === undefined) return undefined;
    const num = Number(householdIdState);
    return isNaN(num) ? null : num;
  }, [householdIdState]);

  return (
    <LayoutContext.Provider
      value={{
        activeNav,
        setActiveNav,
        householdId,
        setHouseholdId,
        isSidebarCollapsed,
        setIsSidebarCollapsed,
      }}
    >
      {children}
    </LayoutContext.Provider>
  );
}


export function useLayout() {
  const context = useContext(LayoutContext);
  if (context === undefined) {
    throw new Error("useLayout must be used within a LayoutProvider");
  }
  return context;
}
