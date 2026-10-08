"use client";

import { usePathname } from "@/navigation";
import { useTranslation, Sidebar as SharedSidebar } from "@alfheim/shared";
import {
  LayoutDashboard,
  LayoutGrid,
  Goal,
  PlusCircle,
} from "lucide-react";
import { useTodayChores } from "@/features/chore_management/services/choresService";

export function Sidebar() {
  const { t } = useTranslation();
  const pathname = usePathname();
  const { data: todayChores = [] } = useTodayChores();
  const pendingCount = (todayChores ?? []).filter(c => c.status !== "completed").length;

  const navItems = [
    {
      href: "/",
      label: t("chores.dashboard"),
      icon: <LayoutDashboard className="h-4 w-4 shrink-0" />,
    },
    {
      href: "/board",
      label: t("chores.board"),
      icon: <LayoutGrid className="h-4 w-4 shrink-0" />,
    },
    {
      href: "/insights",
      label: t("chores.insights"),
      icon: <Goal className="h-4 w-4 shrink-0" />,
    },
    {
      href: "/wizard",
      label: t("chores.wizard"),
      icon: <PlusCircle className="h-4 w-4 shrink-0" />,
    },
  ];

  return (
    <SharedSidebar
      appName="chores"
      navItems={navItems}
      activeHref={pathname}
      isCollapsible={true}
      collapsedWidth="w-20"
      expandedWidth="w-64"
      bottomContent={
        pendingCount > 0 && (
          <div className="text-xs text-[var(--text-muted)]">
            <div className="font-mono text-[10px] font-bold uppercase tracking-wider mb-2">
              {t("chores.dashboard")}
            </div>
            <div className="px-3 py-2 rounded-lg bg-[var(--primary-main)] text-black font-bold">
              {t("chores.pendingCount", { count: pendingCount })}
            </div>
          </div>
        )
      }
    />
  );
}
