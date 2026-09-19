"use client";

import React, { createContext, useContext, useState, ReactNode } from "react";
import { useActiveHousehold } from "@alfheim/shared";

export type NavOption = "devices" | "maintenance" | "scheduled" | "history" | "shopping";

interface LayoutContextType {
  activeNav: NavOption;
  setActiveNav: (nav: NavOption) => void;
  /** Active core/household id (UUID string) from the shared HouseholdProvider. */
  householdId: string | null;
  isSidebarCollapsed: boolean;
  setIsSidebarCollapsed: (collapsed: boolean) => void;
}

const LayoutContext = createContext<LayoutContextType | undefined>(undefined);

export function LayoutProvider({ children }: { children: ReactNode }) {
  const [activeNav, setActiveNav] = useState<NavOption>("devices");
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

  const { householdId } = useActiveHousehold();

  return (
    <LayoutContext.Provider
      value={{
        activeNav,
        setActiveNav,
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
