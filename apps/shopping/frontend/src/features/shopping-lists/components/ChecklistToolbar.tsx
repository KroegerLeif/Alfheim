"use client";

import { Search, X } from "lucide-react";
import { useTranslations } from "next-intl";

interface ChecklistToolbarProps {
  query: string;
  onQueryChange: (value: string) => void;
  openCount: number;
  completedCount: number;
}

/** Search field and open/completed counters above the checklist. */
export function ChecklistToolbar({ query, onQueryChange, openCount, completedCount }: ChecklistToolbarProps) {
  const t = useTranslations("Checklist");

  return (
    <div className="p-3 border-b border-[var(--border-subtle)] flex items-center justify-between gap-3 shrink-0">
      <div className="flex-1 min-w-0 flex items-center gap-2 h-9 px-3 rounded-lg bg-[var(--surface-canvas)] border border-[var(--border-subtle)]">
        <Search className="h-3.5 w-3.5 text-[var(--text-muted)] shrink-0" />
        <input
          type="text"
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
          placeholder={t("searchPlaceholder")}
          aria-label={t("searchLabel")}
          className="flex-1 min-w-0 bg-transparent border-none outline-none font-heading text-xs font-semibold text-[var(--text-main)] placeholder:[var(--text-muted)]"
        />
        {query && (
          <button
            type="button"
            onClick={() => onQueryChange("")}
            className="cursor-pointer text-[var(--text-muted)] hover:text-[var(--text-main)] shrink-0"
            aria-label={t("clearSearch")}
            title={t("clearSearch")}
          >
            <X className="h-3 w-3" />
          </button>
        )}
      </div>

      <div className="flex items-center gap-1.5 font-mono text-[10px] font-bold text-[var(--text-muted)] shrink-0 select-none">
        <span className="text-[var(--primary-main)]">{openCount}</span> {t("open")}
        <span>•</span>
        <span className="text-[var(--text-muted)]">{completedCount}</span> {t("completed")}
      </div>
    </div>
  );
}
