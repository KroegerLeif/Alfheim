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
import { Specular } from "@loeger-os/shared";
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
  }, [activeList, username, households, navT, t]);

  const handleShare = () => {
    if (typeof window !== "undefined") {
      navigator.clipboard.writeText(window.location.href);
      setCopiedNotification(true);
      setTimeout(() => setCopiedNotification(false), 2500);
    }
  };

  const handlePrint = () => {
    if (typeof window !== "undefined") {
      window.print();
    }
  };

  return (
    <div className="glass-card rounded-2xl p-4 md:p-5 relative overflow-hidden shrink-0">
      <Specular opacityClassName="via-white/30 dark:via-white/10" />

      <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        {/* Active List Meta */}
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-blue-500 via-blue-600 to-indigo-700 flex items-center justify-center text-white shadow-lg shadow-blue-500/25 shrink-0 border border-blue-400/30">
            {activeList?.is_default ? (
              <Home className="h-6 w-6" />
            ) : activeList?.is_personal ? (
              <User className="h-6 w-6" />
            ) : (
              <ShoppingCart className="h-6 w-6" />
            )}
          </div>

          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-2">
              <h1 className="font-heading text-xl md:text-2xl font-black uppercase tracking-wide leading-none text-foreground">
                {displayListName}
              </h1>

              <span className="font-mono text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-500 dark:text-blue-400 border border-blue-500/20 uppercase">
                {activeList?.is_default || activeList?.is_personal
                  ? t("systemProtected")
                  : t("customList")}
              </span>
            </div>

            <span className="font-mono text-xs text-muted-foreground/70">
              {checkedCount} {t("completed")} · {totalCount - checkedCount} {t("open")}
            </span>
          </div>
        </div>

        {/* Circular Progress & Action Toolbar */}
        <div className="flex items-center gap-3 w-full md:w-auto justify-between md:justify-end">
          {/* Circular Progress Ring */}
          <div className="flex items-center gap-2.5 glass-inset px-3 py-1.5 rounded-xl shrink-0">
            <div className="w-9 h-9 rounded-lg flex items-center justify-center relative shrink-0">
              <svg width="28" height="28" viewBox="0 0 36 36" className="transform -rotate-90">
                <circle cx="18" cy="18" r="15" fill="none" className="stroke-border/40" strokeWidth="3" />
                <circle
                  cx="18"
                  cy="18"
                  r="15"
                  fill="none"
                  stroke="url(#canvasProgressGrad)"
                  strokeWidth="3.5"
                  strokeLinecap="round"
                  strokeDasharray={strokeDash}
                  className="transition-all duration-500 ease-out"
                />
                <defs>
                  <linearGradient id="canvasProgressGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" stopColor="#3b82f6" />
                    <stop offset="100%" stopColor="#06b6d4" />
                  </linearGradient>
                </defs>
              </svg>
            </div>
            <div className="flex flex-col leading-none">
              <span className="font-mono text-xs font-black text-foreground">
                {percentage}%
              </span>
              <span className="text-[9px] font-mono text-muted-foreground/50 uppercase">
                {t("progress")}
              </span>
            </div>
          </div>

          {/* Action Buttons: Share, Print, Clear Completed */}
          <div className="flex items-center gap-1.5">
            <button
              onClick={handleShare}
              className="p-2 rounded-xl glass-inset hover:glass-active text-muted-foreground hover:text-foreground cursor-pointer transition-all"
              title={t("share")}
            >
              <Share2 className="h-4 w-4" />
            </button>

            <button
              onClick={handlePrint}
              className="p-2 rounded-xl glass-inset hover:glass-active text-muted-foreground hover:text-foreground cursor-pointer transition-all"
              title={t("print")}
            >
              <Printer className="h-4 w-4" />
            </button>

            {checkedCount > 0 && (
              <button
                onClick={onClearCompleted}
                className="p-2 rounded-xl glass-inset hover:bg-red-500/10 text-muted-foreground hover:text-red-400 cursor-pointer transition-all"
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
                className="h-9 px-3.5 rounded-xl flex items-center gap-2 font-heading text-xs font-black uppercase tracking-wider text-white bg-gradient-to-br from-blue-500 to-cyan-500 hover:scale-[1.02] shadow-md shadow-blue-500/20 cursor-pointer transition-all shrink-0"
              >
                <Archive className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">{t("einlagernBtn")}</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {copiedNotification && (
        <div className="mt-2 text-center text-xs font-mono text-emerald-500 font-bold animate-in fade-in">
          ✓ {t("linkCopied")}
        </div>
      )}
    </div>
  );
}
