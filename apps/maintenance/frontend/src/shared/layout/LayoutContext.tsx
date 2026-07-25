"use client";

import React, { createContext, useContext, useState, ReactNode } from "react";

export type NavOption = "devices" | "maintenance" | "scheduled" | "history" | "shopping";

interface LayoutContextType {
  activeNav: NavOption;
  setActiveNav: (nav: NavOption) => void;
  householdId: number | null;
  setHouseholdId: (id: number | null) => void;
  isSidebarCollapsed: boolean;
  setIsSidebarCollapsed: (collapsed: boolean) => void;
}

const LayoutContext = createContext<LayoutContextType | undefined>(undefined);

export function LayoutProvider({ children }: { children: ReactNode }) {
  const [activeNav, setActiveNav] = useState<NavOption>("devices");
  const [householdId, setHouseholdId] = useState<number | null>(null);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

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
