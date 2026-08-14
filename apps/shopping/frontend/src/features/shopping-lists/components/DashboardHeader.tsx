"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import {
  ShoppingCart,
  Archive,
  Home,
  User,
  Share2,
  Printer,
  Trash2,
} from "lucide-react";
import type { ShoppingList } from "../types";
import type { Household } from "../services/shoppingListService";

interface DashboardHeaderProps {
  activeList: ShoppingList | undefined;
  username: string | undefined;
  households: Household[];
  checkedCount: number;
  totalCount: number;
  onSync: () => void;
  onClearCompleted: () => void;
  isSyncPending: boolean;
}

export function DashboardHeader({
  activeList,
  username,
  households,
  checkedCount,
  totalCount,
  onSync,
  onClearCompleted,
  isSyncPending,
}: DashboardHeaderProps) {
  const t = useTranslations("Checklist");
  const navT = useTranslations("Navigation");

  const [copiedNotification, setCopiedNotification] = useState(false);

  const progress = totalCount > 0 ? Math.min(Math.max(checkedCount / totalCount, 0), 1) : 0;
  const percentage = totalCount > 0 ? Math.round((checkedCount / totalCount) * 100) : 0;
  const circumference = 2 * Math.PI * 15; // r=15
  const strokeDash = totalCount > 0 ? `${progress * circumference} ${circumference}` : `0 ${circumference}`;

  const isPersonalList = (name: string, isPersonalFlag?: boolean) =>
    isPersonalFlag ||
    name.endsWith(" - Liste") ||
    name.endsWith("'s List") ||
    name.startsWith("Lista ");

  const displayListName = useMemo(() => {
    if (!activeList) return t("title");
    if (isPersonalList(activeList.name, activeList.is_personal)) {
      return username && username !== "User"
        ? navT("personalList", { username })
        : navT("personal_list_fallback");
    }
    if (activeList.is_default) {
      const hh = households.find((h) => h.id === activeList.home_id);
      return hh ? hh.name : navT("household_list_fallback");
    }
    return activeList.name;
  }, [activeList, households, username, t, navT]);

  const handleShare = () => {
    if (typeof window !== "undefined") {
      navigator.clipboard.writeText(window.location.href);
      setCopiedNotification(true);
      setTimeout(() => setCopiedNotification(false), 2000);
    }
  };

  const handlePrint = () => {
    if (typeof window !== "undefined") window.print();
  };

  return (
    <div className="bg-[var(--surface-card)] border border-[var(--border-subtle)] rounded-2xl p-5 relative shrink-0 select-none">
      <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
        {/* Left Side: Title & Badge */}
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-10 h-10 rounded-xl bg-[var(--primary-main)]/10 border border-[var(--border-accent)] flex items-center justify-center text-[var(--primary-main)] shrink-0 shadow-[0_0_12px_var(--accent-glow)]">
            {activeList?.is_default ? (
              <Home className="h-5 w-5" />
            ) : activeList?.is_personal ? (
              <User className="h-5 w-5" />
            ) : (
              <ShoppingCart className="h-5 w-5" />
            )}
          </div>

          <div className="flex flex-col min-w-0">
            <h1 className="font-heading text-lg md:text-xl font-black uppercase tracking-wide text-[var(--text-main)] truncate">
              {displayListName}
            </h1>
            <div className="flex items-center gap-2">
              <span className="text-[9px] font-mono text-[var(--text-muted)] uppercase tracking-widest">
                {activeList?.is_default
                  ? t("systemProtected")
                  : activeList?.is_personal
                  ? navT("personal_lists")
                  : t("customList")}
              </span>
            </div>
          </div>
        </div>

        {/* Right Side: Progress Ring & Actions */}
        <div className="flex items-center gap-4 shrink-0">
          {/* Progress Circular Indicator */}
          <div className="flex items-center gap-2 bg-[var(--surface-canvas)] border border-[var(--border-subtle)] px-3 py-1.5 rounded-xl">
            <div className="relative w-8 h-8 flex items-center justify-center">
              <svg className="w-8 h-8 transform -rotate-90" viewBox="0 0 36 36">
                <circle
                  cx="18"
                  cy="18"
                  r="15"
                  fill="none"
                  stroke="var(--border-subtle)"
                  strokeWidth="3.5"
                />
                <circle
                  cx="18"
                  cy="18"
                  r="15"
                  fill="none"
                  stroke="var(--primary-main)"
                  strokeWidth="3.5"
                  strokeLinecap="round"
                  strokeDasharray={strokeDash}
                  className="transition-all duration-500 ease-out"
                />
              </svg>
            </div>
            <div className="flex flex-col leading-none">
              <span className="font-mono text-xs font-bold text-[var(--text-main)]">
                {percentage}%
              </span>
              <span className="text-[9px] font-mono text-[var(--text-muted)] uppercase">
                {t("progress")}
              </span>
            </div>
          </div>

          {/* Action Buttons: Share, Print, Clear Completed */}
          <div className="flex items-center gap-1.5">
            <button
              onClick={handleShare}
              className="p-2 rounded-xl bg-[var(--surface-canvas)] hover:bg-[var(--surface-elevated)] border border-[var(--border-subtle)] text-[var(--text-muted)] hover:text-[var(--text-main)] cursor-pointer transition-all"
              title={t("share")}
            >
              <Share2 className="h-4 w-4" />
            </button>

            <button
              onClick={handlePrint}
              className="p-2 rounded-xl bg-[var(--surface-canvas)] hover:bg-[var(--surface-elevated)] border border-[var(--border-subtle)] text-[var(--text-muted)] hover:text-[var(--text-main)] cursor-pointer transition-all"
              title={t("print")}
            >
              <Printer className="h-4 w-4" />
            </button>

            {checkedCount > 0 && (
              <button
                onClick={onClearCompleted}
                className="p-2 rounded-xl bg-[var(--surface-canvas)] hover:bg-red-500/10 border border-[var(--border-subtle)] text-[var(--text-muted)] hover:text-red-400 cursor-pointer transition-all"
                title={t("clearCompleted")}
              >
                <Trash2 className="h-4 w-4" />
              </button>
            )}

            {/* Primary Action Button: Store Einkauf */}
            {totalCount > 0 && checkedCount > 0 && (
              <button
                onClick={onSync}
                disabled={isSyncPending}
                className="h-9 px-3.5 rounded-xl flex items-center gap-2 font-heading text-xs font-bold uppercase tracking-wider text-slate-950 bg-[var(--primary-main)] hover:bg-[var(--primary-hover)] shadow-md cursor-pointer transition-all shrink-0"
              >
                <Archive className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">{t("einlagernBtn")}</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {copiedNotification && (
        <div className="mt-2 text-center text-xs font-mono text-[var(--primary-main)] font-bold animate-in fade-in">
          ✓ {t("linkCopied")}
        </div>
      )}
    </div>
  );
}
