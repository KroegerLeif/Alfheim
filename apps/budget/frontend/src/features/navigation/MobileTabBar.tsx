"use client";

import React, { useState } from "react";
import {
  LayoutDashboard,
  Calendar,
  Plus,
  PiggyBank,
  Ellipsis,
  Landmark,
  ArrowLeftRight,
  GitMerge,
  TrendingUp,
} from "lucide-react";
import { useTranslation } from "@alfheim/shared";

export type TabKey =
  | "dashboard"
  | "planning"
  | "pots"
  | "accounts"
  | "transactions"
  | "sankey"
  | "analytics";
export type PlanType = "monthly" | "event";

export interface MobileTabBarProps {
  activeTab?: TabKey;
  planningMode?: PlanType;
  onPlanningModeChange?: (mode: PlanType) => void;
  onQuickAdd?: () => void;
  onTabChange?: (tab: TabKey) => void;
}

// Views that do not fit the bottom bar; reached through the "More" menu.
const MORE_ITEMS: { key: TabKey; labelKey: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { key: "accounts", labelKey: "budget.navigation.accounts", icon: Landmark },
  { key: "transactions", labelKey: "budget.navigation.transactions", icon: ArrowLeftRight },
  { key: "sankey", labelKey: "budget.navigation.sankey", icon: GitMerge },
  { key: "analytics", labelKey: "budget.navigation.analytics", icon: TrendingUp },
];

const MORE_PANEL_ID = "budget-mobile-more-menu";

/**
 * Mobile bottom navigation bar component for Budget & Treasury app.
 * Provides bottom tabs: Dashboard, Planning (with a monthly / event segmented control), Quick-Add (+),
 * Pots, and a More menu that opens the Accounts, Transactions, Sankey and Analytics views.
 */
export function MobileTabBar({
  activeTab = "dashboard",
  planningMode = "monthly",
  onPlanningModeChange,
  onQuickAdd,
  onTabChange,
}: MobileTabBarProps) {
  const { t } = useTranslation();
  const [moreOpen, setMoreOpen] = useState(false);
  const isMoreActive = MORE_ITEMS.some((item) => item.key === activeTab);

  const selectTab = (tab: TabKey) => {
    setMoreOpen(false);
    onTabChange?.(tab);
  };

  return (
    <>
      {moreOpen && (
        <div
          id={MORE_PANEL_ID}
          role="group"
          aria-label={t("budget.navigation.more")}
          className="md:hidden fixed bottom-16 left-2 right-2 p-2 grid grid-cols-2 gap-2 bg-[var(--surface-card)] border border-[var(--border-subtle)] rounded-xl shadow-2xl z-40"
        >
          {MORE_ITEMS.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.key;
            return (
              <button
                key={item.key}
                type="button"
                onClick={() => selectTab(item.key)}
                aria-current={isActive ? "page" : undefined}
                className={`flex items-center gap-2 px-3 py-2.5 rounded-lg text-xs font-medium transition-colors ${
                  isActive
                    ? "bg-[var(--primary-main)]/10 text-[var(--primary-main)] font-semibold"
                    : "text-[var(--text-muted)] hover:bg-[var(--surface-canvas)] hover:text-[var(--text-main)]"
                }`}
              >
                <Icon className="w-4 h-4" />
                <span>{t(item.labelKey)}</span>
              </button>
            );
          })}
        </div>
      )}

      <nav
        aria-label={t("budget.navigation.mobileNavLabel")}
        className="md:hidden fixed bottom-0 left-0 right-0 h-16 bg-[var(--surface-card)]/95 backdrop-blur-md border-t border-[var(--border-subtle)] px-2 flex items-center justify-around z-40 select-none shadow-[0_-4px_20px_rgba(0,0,0,0.4)]"
      >
        {/* 1. Dashboard Tab */}
        <button
          type="button"
          onClick={() => selectTab("dashboard")}
          aria-current={activeTab === "dashboard" ? "page" : undefined}
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
          <span className="text-[10px] tracking-tight mt-1">{t("budget.navigation.dashboard")}</span>
        </button>

        {/* 2. Planning tab with a monthly / event segmented control */}
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
          <button
            type="button"
            onClick={() => selectTab("planning")}
            aria-current={activeTab === "planning" ? "page" : undefined}
            className="flex flex-col items-center justify-center hover:text-[var(--text-main)]"
          >
            <Calendar className="w-5 h-5" />
            <span className="text-[10px] tracking-tight mt-0.5">{t("budget.navigation.planning")}</span>
          </button>
          {/* Segmented control for monthly / event planning */}
          <div
            role="group"
            aria-label={t("budget.navigation.planningModeLabel")}
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
              {t("budget.navigation.monthly")}
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
              {t("budget.navigation.event")}
            </button>
          </div>
        </div>

        {/* 3. Quick-Add (+) Button */}
        <div className="flex flex-col items-center justify-center flex-1 h-full py-1">
          <button
            type="button"
            onClick={onQuickAdd}
            aria-label={t("budget.transactions.quickAdd")}
            className="w-10 h-10 rounded-full bg-[var(--primary-main)] text-white flex items-center justify-center shadow-md hover:opacity-90 active:scale-95 transition-all"
          >
            <Plus className="w-6 h-6" />
          </button>
        </div>

        {/* 4. Pots Tab */}
        <button
          type="button"
          onClick={() => selectTab("pots")}
          aria-current={activeTab === "pots" ? "page" : undefined}
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
          <span className="text-[10px] tracking-tight mt-1">{t("budget.navigation.pots")}</span>
        </button>

        {/* 5. More menu: views without a bottom tab */}
        <button
          type="button"
          onClick={() => setMoreOpen((open) => !open)}
          aria-expanded={moreOpen}
          aria-controls={MORE_PANEL_ID}
          className={`relative flex flex-col items-center justify-center flex-1 h-full py-1 transition-colors duration-200 ${
            isMoreActive || moreOpen
              ? "text-[var(--primary-main)] font-semibold"
              : "text-[var(--text-muted)] hover:text-[var(--text-main)]"
          }`}
        >
          {isMoreActive && (
            <span className="absolute top-0 w-8 h-1 bg-[var(--primary-main)] rounded-b-full shadow-[0_0_8px_var(--primary-main)]" />
          )}
          <Ellipsis className="w-5 h-5" />
          <span className="text-[10px] tracking-tight mt-1">{t("budget.navigation.more")}</span>
        </button>
      </nav>
    </>
  );
}
