"use client";

import { createContext, useContext, useState, type ReactNode } from "react";

/** Whether the shopping sidebar is expanded. */
export const SidebarContext = createContext<{
  isSidebarOpen: boolean;
  setIsSidebarOpen: (open: boolean) => void;
}>({
  isSidebarOpen: true,
  setIsSidebarOpen: () => {},
});

/** Reads the sidebar state. */
export const useSidebar = () => useContext(SidebarContext);

/** The shopping list currently shown on the start page. */
export const ActiveListContext = createContext<{
  activeListId: string | null;
  setActiveListId: (id: string | null) => void;
}>({
  activeListId: null,
  setActiveListId: () => {},
});

/** Reads the active shopping list. */
export const useActiveList = () => useContext(ActiveListContext);

/** Holds the sidebar and active-list state for the shopping shell. */
export function ShellStateProvider({ children }: { children: ReactNode }) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [activeListId, setActiveListId] = useState<string | null>(null);
  return (
    <SidebarContext.Provider value={{ isSidebarOpen, setIsSidebarOpen }}>
      <ActiveListContext.Provider value={{ activeListId, setActiveListId }}>{children}</ActiveListContext.Provider>
    </SidebarContext.Provider>
  );
}
