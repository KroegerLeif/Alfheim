import React from "react";
import { Button, useTranslation } from "@alfheim/shared";
import { CategoryTab } from "../types";

interface CatalogFilterBarProps {
  category: CategoryTab;
  setCategory: (cat: CategoryTab) => void;
  query: string;
  setQuery: (q: string) => void;
  isCookbook: boolean;
  setIsCookbook: (cb: boolean) => void;
  activeProvidersOnly: boolean;
  setActiveProvidersOnly: (prov: boolean) => void;
}

export function CatalogFilterBar({
  category,
  setCategory,
  query,
  setQuery,
  isCookbook,
  setIsCookbook,
  activeProvidersOnly,
  setActiveProvidersOnly,
}: CatalogFilterBarProps) {
  const { t } = useTranslation();

  const tabs: { key: CategoryTab; label: string }[] = [
    { key: "ALL", label: t("library.catalog.filterAll") },
    { key: "BOOK", label: t("library.catalog.filterBooks") },
    { key: "GAME", label: t("library.catalog.filterBoardGames") },
    { key: "MOVIE", label: t("library.catalog.filterMovies") },
    { key: "SERIES", label: t("library.catalog.filterSeries") },
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
        <div className="relative flex-1 max-w-md">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t("library.catalog.searchPlaceholder")}
            className="w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-card)] px-4 py-2.5 text-sm text-[var(--text-main)] placeholder-[var(--text-muted)] focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary transition-colors"
          />
          {query && (
            <button
              onClick={() => setQuery("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-[var(--text-muted)] hover:text-[var(--text-main)]"
            >
              ✕
            </button>
          )}
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <Button
            type="button"
            variant={isCookbook ? "default" : "outline"}
            size="sm"
            onClick={() => setIsCookbook(!isCookbook)}
            className={
              isCookbook
                ? "bg-amber-600 hover:bg-amber-500 text-white border-amber-600"
                : ""
            }
          >
            🍳 {t("library.catalog.filterCookbooks")}
          </Button>

          <Button
            type="button"
            variant={activeProvidersOnly ? "default" : "outline"}
            size="sm"
            onClick={() => setActiveProvidersOnly(!activeProvidersOnly)}
          >
            📺 {t("library.catalog.availableOnProviders")}
          </Button>
        </div>
      </div>

      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 border-b border-[var(--border-subtle)]">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setCategory(tab.key)}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors cursor-pointer ${
              category === tab.key
                ? "bg-primary text-primary-foreground shadow-sm"
                : "text-[var(--text-muted)] hover:text-[var(--text-main)] hover:bg-[var(--surface-card)]"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>
    </div>
  );
}
