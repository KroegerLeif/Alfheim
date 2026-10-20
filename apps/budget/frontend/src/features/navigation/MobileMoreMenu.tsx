"use client";

import React from "react";
import { Ellipsis, Landmark, ArrowLeftRight, GitMerge, TrendingUp } from "lucide-react";
import { useTranslation } from "@alfheim/shared";
import type { TabKey } from "./MobileTabBar";

// Views that do not fit the bottom bar; reached through the "More" menu.
const MORE_ITEMS: { key: TabKey; labelKey: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { key: "accounts", labelKey: "budget.navigation.accounts", icon: Landmark },
  { key: "transactions", labelKey: "budget.navigation.transactions", icon: ArrowLeftRight },
  { key: "sankey", labelKey: "budget.navigation.sankey", icon: GitMerge },
  { key: "analytics", labelKey: "budget.navigation.analytics", icon: TrendingUp },
];

export const MORE_PANEL_ID = "budget-mobile-more-menu";

export const isMoreTab = (tab: TabKey): boolean => MORE_ITEMS.some((item) => item.key === tab);

interface MobileMoreButtonProps {
  active: boolean;
  open: boolean;
  onToggle: () => void;
}

/** Bottom bar entry that opens the More panel. Must render inside the tab bar <nav>. */
export function MobileMoreButton({ active, open, onToggle }: MobileMoreButtonProps) {
  const { t } = useTranslation();

  return (
    <button
      type="button"
      onClick={onToggle}
      aria-expanded={open}
      aria-controls={MORE_PANEL_ID}
      className={`relative flex flex-col items-center justify-center flex-1 h-full py-1 transition-colors duration-200 ${
        active || open
          ? "text-[var(--primary-main)] font-semibold"
          : "text-[var(--text-muted)] hover:text-[var(--text-main)]"
      }`}
    >
      {active && (
        <span className="absolute top-0 w-8 h-1 bg-[var(--primary-main)] rounded-b-full shadow-[0_0_8px_var(--primary-main)]" />
      )}
      <Ellipsis className="w-5 h-5" />
      <span className="text-[10px] tracking-tight mt-1">{t("budget.navigation.more")}</span>
    </button>
  );
}

interface MobileMorePanelProps {
  activeTab: TabKey;
  onSelect: (tab: TabKey) => void;
}

/**
 * Panel listing the More views. Rendered outside the tab bar <nav>: the nav's backdrop-blur
 * would otherwise become the containing block and break the fixed positioning.
 */
export function MobileMorePanel({ activeTab, onSelect }: MobileMorePanelProps) {
  const { t } = useTranslation();

  return (
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
            onClick={() => onSelect(item.key)}
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
  );
}
