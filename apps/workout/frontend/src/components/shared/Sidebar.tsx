"use client";

import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { AppLogo, cn, useTranslation } from "@alfheim/shared";
import { Link } from "@/navigation";
import { useActiveNavHref, useWorkoutNavItems } from "./navItems";

const COLLAPSE_KEY = "alfheim_workout_sidebar_collapsed";

/**
 * Desktop navigation rail. Hidden below the md breakpoint, where
 * WorkoutBottomNav takes over — AppShell renders its sidebar slot at every
 * width, so the breakpoint guard has to live here.
 */
export function Sidebar() {
  const { t } = useTranslation();
  const items = useWorkoutNavItems();
  const activeHref = useActiveNavHref(items);
  const [isCollapsed, setIsCollapsed] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem(COLLAPSE_KEY);
    if (saved !== null) {
      setIsCollapsed(saved === "true");
    }
  }, []);

  const toggleCollapse = () => {
    setIsCollapsed((prev) => {
      const next = !prev;
      localStorage.setItem(COLLAPSE_KEY, String(next));
      return next;
    });
  };

  return (
    <aside
      className={cn(
        "hidden md:flex h-full shrink-0 flex-col select-none font-sans transition-all duration-300 ease-in-out",
        "border-r border-[var(--border-subtle)] bg-[var(--surface-card)] text-[var(--text-main)]",
        isCollapsed ? "w-20" : "w-64"
      )}
    >
      <div className="flex h-16 items-center gap-3 border-b border-[var(--border-subtle)] px-4">
        <AppLogo appName="workout" size={32} />
        {!isCollapsed && (
          <span className="truncate font-heading text-sm font-bold uppercase tracking-wide">
            {t("workout.title")}
          </span>
        )}
      </div>

      <nav aria-label={t("workout.title")} className="flex-1 space-y-1 overflow-y-auto p-3">
        {items.map((item) => {
          const isActive = item.href === activeHref;
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={isActive ? "page" : undefined}
              title={isCollapsed ? item.label : undefined}
              className={cn(
                "flex min-h-11 items-center gap-3 rounded-lg px-3 font-mono text-xs font-bold uppercase tracking-wider transition-colors",
                isCollapsed && "justify-center",
                isActive
                  ? "bg-[var(--primary-main)] text-black"
                  : "text-[var(--text-muted)] hover:bg-[var(--surface-elevated)] hover:text-[var(--text-main)]"
              )}
            >
              <span aria-hidden="true">{item.icon}</span>
              {!isCollapsed && <span className="truncate">{item.label}</span>}
            </Link>
          );
        })}
      </nav>

      <button
        type="button"
        onClick={toggleCollapse}
        aria-expanded={!isCollapsed}
        aria-label={t(isCollapsed ? "common.expand_sidebar" : "common.collapse_sidebar")}
        className="flex min-h-11 cursor-pointer items-center justify-center border-t border-[var(--border-subtle)] text-[var(--text-muted)] transition-colors hover:text-[var(--text-main)]"
      >
        {isCollapsed ? (
          <ChevronRight className="h-4 w-4" aria-hidden="true" />
        ) : (
          <ChevronLeft className="h-4 w-4" aria-hidden="true" />
        )}
      </button>
    </aside>
  );
}
