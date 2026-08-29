"use client";

import React from "react";
import Link from "next/link";
import { LayoutDashboard, Calendar, Plus, PiggyBank } from "lucide-react";

export type TabKey = "dashboard" | "planning" | "pots";
export type PlanType = "monthly" | "event";

export interface MobileTabBarProps {
  activeTab?: TabKey;
  planningMode?: PlanType;
  onPlanningModeChange?: (mode: PlanType) => void;
  onQuickAdd?: () => void;
  onTabChange?: (tab: TabKey) => void;
}

/**
 * Mobile bottom navigation bar component for Budget & Treasury app.
 * Provides 4 bottom tabs: Dashboard, Planning (with Monat / Event Segmented Control), Quick-Add (+), and Pots.
 */
export function MobileTabBar({
  activeTab = "dashboard",
  planningMode = "monthly",
  onPlanningModeChange,
  onQuickAdd,
  onTabChange,
}: MobileTabBarProps) {
  return (
    <nav
      aria-label="Mobile Navigation"
      className="md:hidden fixed bottom-0 left-0 right-0 h-16 bg-[var(--surface-card)]/95 backdrop-blur-md border-t border-[var(--border-subtle)] px-2 flex items-center justify-around z-40 select-none shadow-[0_-4px_20px_rgba(0,0,0,0.4)]"
    >
      {/* 1. Dashboard Tab */}
      <Link
        href="/"
        onClick={(e) => {
          if (onTabChange) {
            e.preventDefault();
            onTabChange("dashboard");
          }
        }}
        className={`relative flex flex-col items-center justify-center flex-1 h-full py-1 transition-colors duration-200 ${
          activeTab === "dashboard"
            ? "text-[var(--primary-main)] font-semibold"
            : "text-[var(--text-muted)] hover:text-[var(--text-main)]"
        }`}
      >
        {activeTab === "dashboard" && (
          <span className="absolute top-0 w-8 h-1 bg-[var(--primary-main)] rounded-b-full shadow-[0_0_8px_var(--primary-main)]" />
        )}
        <LayoutDashboard className="w-5 h-5" />
        <span className="text-[10px] tracking-tight mt-1">Dashboard</span>
      </Link>

      {/* 2. Planning Tab with Monat / Event Segmented Control */}
      <div
        className={`relative flex flex-col items-center justify-center flex-1 h-full py-1 transition-colors duration-200 ${
          activeTab === "planning"
            ? "text-[var(--primary-main)] font-semibold"
            : "text-[var(--text-muted)]"
        }`}
      >
        {activeTab === "planning" && (
          <span className="absolute top-0 w-8 h-1 bg-[var(--primary-main)] rounded-b-full shadow-[0_0_8px_var(--primary-main)]" />
        )}
        <Link
          href="/planning"
          onClick={(e) => {
            if (onTabChange) {
              e.preventDefault();
              onTabChange("planning");
            }
          }}
          className="flex flex-col items-center justify-center hover:text-[var(--text-main)]"
        >
          <Calendar className="w-5 h-5" />
          <span className="text-[10px] tracking-tight mt-0.5">Planning</span>
        </Link>
        {/* Segmented Control for Monat / Event */}
        <div
          role="group"
          aria-label="Planning Mode"
          className="flex items-center bg-[var(--surface-canvas)] rounded-full p-0.5 mt-0.5 text-[9px]"
        >
          <button
            type="button"
            onClick={() => {
              onTabChange?.("planning");
              onPlanningModeChange?.("monthly");
            }}
            className={`px-1.5 py-0.2 rounded-full transition-all ${
              planningMode === "monthly"
                ? "bg-[var(--primary-main)] text-white font-bold"
                : "text-[var(--text-muted)] hover:text-[var(--text-main)]"
            }`}
          >
            Monat
          </button>
          <button
            type="button"
            onClick={() => {
              onTabChange?.("planning");
              onPlanningModeChange?.("event");
            }}
            className={`px-1.5 py-0.2 rounded-full transition-all ${
              planningMode === "event"
                ? "bg-[var(--primary-main)] text-white font-bold"
                : "text-[var(--text-muted)] hover:text-[var(--text-main)]"
            }`}
          >
            Event
          </button>
        </div>
      </div>

      {/* 3. Quick-Add (+) Button */}
      <div className="flex flex-col items-center justify-center flex-1 h-full py-1">
        <button
          type="button"
          onClick={onQuickAdd}
          aria-label="Quick-Add Transaction"
          className="w-10 h-10 rounded-full bg-[var(--primary-main)] text-white flex items-center justify-center shadow-md hover:opacity-90 active:scale-95 transition-all"
        >
          <Plus className="w-6 h-6" />
        </button>
      </div>

      {/* 4. Pots Tab */}
      <Link
        href="/pots"
        onClick={(e) => {
          if (onTabChange) {
            e.preventDefault();
            onTabChange("pots");
          }
        }}
        className={`relative flex flex-col items-center justify-center flex-1 h-full py-1 transition-colors duration-200 ${
          activeTab === "pots"
            ? "text-[var(--primary-main)] font-semibold"
            : "text-[var(--text-muted)] hover:text-[var(--text-main)]"
        }`}
      >
        {activeTab === "pots" && (
          <span className="absolute top-0 w-8 h-1 bg-[var(--primary-main)] rounded-b-full shadow-[0_0_8px_var(--primary-main)]" />
        )}
        <PiggyBank className="w-5 h-5" />
        <span className="text-[10px] tracking-tight mt-1">Pots</span>
      </Link>
    </nav>
  );
}
