"use client";

import { Sidebar as SharedSidebar } from "@alfheim/shared";
import { useActiveNavHref, useWorkoutNavItems } from "./navItems";

/**
 * Desktop navigation rail. Hidden below the md breakpoint, where
 * WorkoutBottomNav takes over — AppShell renders its sidebar slot at every
 * width, so the breakpoint guard has to live here.
 */
export function Sidebar() {
  const items = useWorkoutNavItems();
  const activeHref = useActiveNavHref(items);

  return (
    <SharedSidebar
      appName="workout"
      navItems={items}
      activeHref={activeHref || "/"}
      isCollapsible={true}
      collapsedWidth="w-20"
      expandedWidth="w-64"
    />
  );
}
