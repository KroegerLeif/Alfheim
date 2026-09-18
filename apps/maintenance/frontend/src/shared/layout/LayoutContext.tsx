"use client";

import React, { createContext, useContext, useState, ReactNode } from "react";
import { useActiveHousehold } from "@alfheim/shared";

export type NavOption = "devices" | "maintenance" | "scheduled" | "history" | "shopping";

interface LayoutContextType {
  activeNav: NavOption;
  setActiveNav: (nav: NavOption) => void;
  /** Active core/household id (UUID) from the shared HouseholdProvider. */
  activeHouseholdId: string | null;
  /**
   * Legacy numeric maintenance household id for the `household_id` query
   * filter: `undefined` while the household loads, `null` for UUID ids (the
   * backend then scopes by X-Household-ID).
   */
  householdId: number | null | undefined;
  isSidebarCollapsed: boolean;
  setIsSidebarCollapsed: (collapsed: boolean) => void;
}

const LayoutContext = createContext<LayoutContextType | undefined>(undefined);

export function LayoutProvider({ children }: { children: ReactNode }) {
  const [activeNav, setActiveNav] = useState<NavOption>("devices");
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

  const { householdId: activeHouseholdId, status } = useActiveHousehold();

  const householdId = React.useMemo(() => {
    if (status === "loading") return undefined;
    if (!activeHouseholdId) return null;
    const num = Number(activeHouseholdId);
    return isNaN(num) ? null : num;
  }, [activeHouseholdId, status]);

  return (
    <LayoutContext.Provider
      value={{
        activeNav,
        setActiveNav,
        activeHouseholdId,
        householdId,
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
