"use client";

import { useTranslation } from "@loeger-os/shared";
import { Link, usePathname } from "@/navigation";
import { cn } from "@/core/utils";
import { 
  LayoutDashboard, 
  LayoutGrid, 
  Goal, 
  PlusCircle 
} from "lucide-react";
import { useTodayChores } from "@/features/chore_management/services/choresService";

export function Sidebar() {
  const { t } = useTranslation();
  const pathname = usePathname();

  // Retrieve today's chores list to show a warning badge or status if needed
  const { data: todayChores = [] } = useTodayChores();
  const pendingCount = todayChores.filter(c => c.status !== "completed").length;

  const navItems = [
    {
      href: "/",
      label: t("chores.dashboard", { defaultValue: "Dashboard" }),
      icon: LayoutDashboard,
    },
    {
      href: "/board",
      label: t("chores.board", { defaultValue: "Task Board" }),
      icon: LayoutGrid,
    },
    {
      href: "/insights",
      label: t("chores.insights", { defaultValue: "Shared Goals" }),
      icon: Goal,
    },
    {
      href: "/wizard",
      label: t("chores.wizard", { defaultValue: "Task Creator" }),
      icon: PlusCircle,
    },
  ];

  return (
    <aside className="w-64 border-r border-[var(--border-subtle)] bg-[var(--surface-card)] text-[var(--text-main)] flex flex-col h-full select-none font-mono">
      {/* Brand Header */}
      <div className="p-6 border-b border-[var(--border-subtle)] flex flex-col gap-1 select-none">
        <div className="font-heading text-2xl font-bold uppercase tracking-wide leading-none text-[var(--text-main)]">
          {t("chores.systemBrand", { defaultValue: "Chores Tracker" })}
        </div>
        <div className="text-[10px] text-[var(--text-muted)] uppercase tracking-widest font-mono">
          {t("chores.systemVersion", { defaultValue: "v1.0.0" })}
        </div>
      </div>

      {/* Navigation Menu */}
      <nav className="flex-1 p-4 space-y-2">
        {navItems.map((item) => {
          const isActive = pathname === item.href;
          const Icon = item.icon;

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center justify-between px-4 py-3.5 text-sm uppercase font-semibold transition-all border border-transparent cursor-pointer rounded-lg",
                isActive
                  ? "bg-[var(--primary-main)] text-black font-bold border-[var(--primary-main)] shadow-[0_0_12px_var(--accent-glow)]"
                  : "hover:bg-[var(--surface-elevated)] text-[var(--text-main)] hover:border-[var(--border-accent)]"
              )}
            >
              <div className="flex items-center gap-3">
                <Icon className="h-4 w-4 shrink-0" />
                <span>{item.label}</span>
              </div>
              {item.href === "/" && pendingCount > 0 && (
                <span className={`px-2 py-0.5 text-[10px] font-bold rounded-full ${
                  isActive ? "bg-black text-[var(--primary-main)]" : "bg-[var(--primary-main)] text-black"
                }`}>
                  {pendingCount}
                </span>
              )}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
