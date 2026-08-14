"use client";

import React, { useEffect, useState } from "react";
import { useTranslation, AppLogo } from "@alfheim/shared";
import { Link, usePathname } from "@/navigation";
import { cn } from "@/core/utils";
import { 
  LayoutDashboard, 
  LayoutGrid, 
  Goal, 
  PlusCircle,
  ChevronLeft,
  ChevronRight
} from "lucide-react";
import { useTodayChores } from "@/features/chore_management/services/choresService";

export function Sidebar() {
  const { t } = useTranslation();
  const pathname = usePathname();
  const [isCollapsed, setIsCollapsed] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem("alfheim_chores_sidebar_collapsed");
    if (saved !== null) {
      setIsCollapsed(saved === "true");
    }
  }, []);

  const toggleCollapse = () => {
    setIsCollapsed((prev) => {
      const next = !prev;
      localStorage.setItem("alfheim_chores_sidebar_collapsed", String(next));
      return next;
    });
  };

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
    <aside
      className={cn(
        "border-r border-[var(--border-subtle)] bg-[var(--surface-card)] text-[var(--text-main)] flex flex-col h-full select-none font-sans transition-all duration-300 ease-in-out shrink-0 relative",
        isCollapsed ? "w-20" : "w-64"
      )}
    >
      {/* Brand Header */}
      <div
        className={cn(
          "p-5 border-b border-[var(--border-subtle)] flex items-center justify-between",
          isCollapsed && "justify-center"
        )}
      >
        {!isCollapsed && (
          <div className="flex items-center gap-3 select-none">
            <AppLogo appName="chores" size={32} />
            <div className="flex flex-col">
              <div className="font-heading text-sm font-bold uppercase tracking-wider text-[var(--text-main)] leading-tight">
                ALFHEIM // CHORES
              </div>
              <div className="text-[10px] text-[var(--text-muted)] uppercase tracking-widest font-mono">
                Gamified Habits
              </div>
            </div>
          </div>
        )}
        <button
          onClick={toggleCollapse}
          className={cn(
            "p-1.5 rounded-lg bg-[var(--surface-canvas)] border border-[var(--border-subtle)] hover:bg-[var(--surface-elevated)] transition-all text-[var(--text-muted)] hover:text-[var(--text-main)] cursor-pointer",
            isCollapsed && "mx-auto"
          )}
          aria-label={isCollapsed ? "Expand Sidebar" : "Collapse Sidebar"}
        >
          {isCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
        </button>
      </div>

      {/* Navigation Menu */}
      <nav className="flex-1 p-3 space-y-1.5 overflow-y-auto">
        {navItems.map((item) => {
          const isActive = pathname === item.href;
          const Icon = item.icon;

          return (
            <Link
              key={item.href}
              href={item.href}
              title={item.label}
              className={cn(
                "flex items-center text-xs uppercase font-semibold transition-all border border-transparent cursor-pointer rounded-lg relative",
                isCollapsed ? "justify-center p-3" : "justify-between px-3.5 py-2.5",
                isActive
                  ? "bg-[var(--primary-main)] text-black font-bold border-[var(--primary-main)] shadow-[0_0_12px_var(--accent-glow)]"
                  : "hover:bg-[var(--surface-elevated)] text-[var(--text-main)] hover:border-[var(--border-accent)]"
              )}
            >
              <div className="flex items-center gap-3">
                <Icon className={cn("h-4 w-4 shrink-0", isCollapsed && "h-5 w-5")} />
                {!isCollapsed && <span>{item.label}</span>}
              </div>
              {item.href === "/" && pendingCount > 0 && (
                <span
                  className={cn(
                    "px-2 py-0.5 text-[10px] font-bold rounded-full font-mono",
                    isActive ? "bg-black text-[var(--primary-main)]" : "bg-[var(--primary-main)] text-black",
                    isCollapsed && "absolute -top-1 -right-1 px-1.5 py-0.2 text-[9px] shadow-sm"
                  )}
                >
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
