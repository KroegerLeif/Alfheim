"use client";

import React from "react";
import Link from "next/link";
import {
  LayoutDashboard,
  Calendar,
  PiggyBank,
  GitMerge,
  TrendingUp,
  Plus,
  Wallet,
} from "lucide-react";

export interface DesktopSidebarProps {
  currentPath?: string;
  planningMode?: "monthly" | "event";
  onPlanningModeChange?: (mode: "monthly" | "event") => void;
  onQuickAdd?: () => void;
  onTabChange?: (path: string) => void;
}

interface NavItem {
  label: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
}

const NAV_ITEMS: NavItem[] = [
  { label: "Dashboard", href: "/", icon: LayoutDashboard },
  { label: "Planning", href: "/planning", icon: Calendar },
  { label: "Pots", href: "/pots", icon: PiggyBank },
  { label: "Sankey Cashflow", href: "/sankey", icon: GitMerge },
  { label: "Net-Worth Analytics", href: "/analytics", icon: TrendingUp },
];

/**
 * Desktop sidebar navigation component for Budget & Treasury app.
 * Provides full sidebar navigation including Dashboard, Planning (Monat / Event), Pots,
 * Sankey Cashflow view, Net-Worth Analytics, and a Quick-Add button.
 */
export function DesktopSidebar({
  currentPath = "/",
  planningMode = "monthly",
  onPlanningModeChange,
  onQuickAdd,
  onTabChange,
}: DesktopSidebarProps) {
  return (
    <aside
      aria-label="Desktop Sidebar"
      className="hidden md:flex flex-col w-64 min-h-screen bg-[var(--surface-card)] border-r border-[var(--border-subtle)] p-4 select-none"
    >
      {/* Sidebar Header / Brand */}
      <div className="flex items-center gap-3 px-2 py-3 mb-6 border-b border-[var(--border-subtle)]">
        <div className="w-8 h-8 rounded-lg bg-[var(--primary-main)] flex items-center justify-center text-white">
          <Wallet className="w-5 h-5" />
        </div>
        <div>
          <h2 className="font-bold text-base text-[var(--text-main)] leading-tight">
            Budget & Treasury
          </h2>
          <span className="text-[11px] text-[var(--text-muted)]">Alfheim Core</span>
        </div>
      </div>

      {/* Quick-Add Button */}
      <button
        type="button"
        onClick={onQuickAdd}
        aria-label="Quick-Add Transaction"
        className="w-full py-2.5 px-4 mb-6 rounded-lg bg-[var(--primary-main)] text-white font-medium flex items-center justify-center gap-2 shadow-md hover:opacity-95 active:scale-[0.98] transition-all"
      >
        <Plus className="w-5 h-5" />
        <span>Quick-Add</span>
      </button>

      {/* Navigation Links */}
      <nav aria-label="Sidebar Navigation" className="flex-1 space-y-1">
        {NAV_ITEMS.map((item) => {
          const isActive =
            currentPath === item.href ||
            (item.href !== "/" && currentPath.startsWith(item.href));
          const Icon = item.icon;

          return (
            <div key={item.href} className="space-y-1">
              <Link
                href={item.href}
                onClick={(e) => {
                  if (onTabChange) {
                    e.preventDefault();
                    onTabChange(item.href);
                  }
                }}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  isActive
                    ? "bg-[var(--primary-main)]/10 text-[var(--primary-main)] font-semibold"
                    : "text-[var(--text-muted)] hover:bg-[var(--surface-canvas)] hover:text-[var(--text-main)]"
                }`}
              >
                <Icon className="w-5 h-5" />
                <span>{item.label}</span>
              </Link>

              {/* Segmented Control for Planning (Monat / Event) */}
              {item.href === "/planning" && isActive && (
                <div
                  role="group"
                  aria-label="Planning Mode Selector"
                  className="ml-8 mt-1 p-1 flex items-center bg-[var(--surface-canvas)] rounded-lg gap-1 text-xs"
                >
                  <button
                    type="button"
                    onClick={() => onPlanningModeChange?.("monthly")}
                    className={`flex-1 py-1 px-2 rounded-md text-center transition-colors ${
                      planningMode === "monthly"
                        ? "bg-[var(--primary-main)] text-white font-semibold shadow-sm"
                        : "text-[var(--text-muted)] hover:text-[var(--text-main)]"
                    }`}
                  >
                    Monat
                  </button>
                  <button
                    type="button"
                    onClick={() => onPlanningModeChange?.("event")}
                    className={`flex-1 py-1 px-2 rounded-md text-center transition-colors ${
                      planningMode === "event"
                        ? "bg-[var(--primary-main)] text-white font-semibold shadow-sm"
                        : "text-[var(--text-muted)] hover:text-[var(--text-main)]"
                    }`}
                  >
                    Event
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </nav>
    </aside>
  );
}
