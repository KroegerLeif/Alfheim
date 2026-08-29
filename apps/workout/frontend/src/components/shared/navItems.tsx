"use client";

import React from "react";
import { BarChart3, Dumbbell, ListChecks, Zap } from "lucide-react";
import { useTranslation } from "@alfheim/shared";
import { usePathname } from "@/navigation";

export interface WorkoutNavItem {
  href: string;
  label: string;
  icon: React.ReactNode;
}

/**
 * Single source of truth for the app's primary navigation, consumed by both the
 * desktop Sidebar and the mobile BottomNav so the two can never drift apart.
 */
export function useWorkoutNavItems(): WorkoutNavItem[] {
  const { t } = useTranslation();

  return [
    { href: "/", label: t("workout.navToday"), icon: <Zap className="h-5 w-5" /> },
    { href: "/plans", label: t("workout.navPlans"), icon: <ListChecks className="h-5 w-5" /> },
    { href: "/catalog", label: t("workout.navCatalog"), icon: <Dumbbell className="h-5 w-5" /> },
    {
      href: "/analytics",
      label: t("workout.navAnalytics"),
      icon: <BarChart3 className="h-5 w-5" />,
    },
  ];
}

/**
 * Resolve which nav entry the current route belongs to.
 *
 * "/" only matches exactly, so it does not swallow every nested route; the
 * others match their own subtree (e.g. /plans/<id> keeps "Plans" active).
 */
export function useActiveNavHref(items: WorkoutNavItem[]): string | undefined {
  const pathname = usePathname();

  const match = (items ?? []).find((item) =>
    item.href === "/" ? pathname === "/" : pathname.startsWith(item.href)
  );

  return match?.href;
}
