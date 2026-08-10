"use client";

import { Search } from "lucide-react";
import { useTranslation } from "@loeger-os/shared";

interface FilterBarProps {
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  selectedFilter: string;
  setSelectedFilter: (filter: string) => void;
}

export function FilterBar({
  searchQuery,
  setSearchQuery,
  selectedFilter,
  setSelectedFilter,
}: FilterBarProps) {
  const { t } = useTranslation();

  const getFilterLabel = (filterKey: string) => {
    switch (filterKey) {
      case "all": return t("chores.all");
      case "high": return t("chores.high");
      case "medium": return t("chores.medium");
      case "standard": return t("chores.standard");
      default: return filterKey;
    }
  };

  return (
    <div className="flex flex-col md:flex-row gap-4 justify-between items-center mb-6">
      {/* Search Input Box */}
      <div className="relative w-full md:max-w-xs">
        <span className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-[var(--text-muted)]">
          <Search className="h-4 w-4" />
        </span>
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder={t("chores.searchPlaceholder")}
          className="w-full pl-9 pr-4 py-2 text-sm bg-[var(--surface-card)] border border-[var(--border-subtle)] focus:border-[var(--border-accent)] focus:outline-none text-[var(--text-main)] rounded-lg font-sans"
        />
      </div>

      {/* Filter Tabs */}
      <div className="flex bg-[var(--surface-container)] border border-[var(--border-subtle)] p-1 rounded-lg w-full md:w-auto overflow-x-auto select-none">
        {["all", "high", "medium", "standard"].map((filter) => (
          <button
            key={filter}
            onClick={() => setSelectedFilter(filter)}
            className={`flex-1 md:flex-initial px-4 py-1.5 text-xs font-mono font-semibold uppercase tracking-wider transition-colors cursor-pointer rounded-md ${
              selectedFilter === filter
                ? "bg-[var(--primary-main)] text-black font-bold"
                : "text-[var(--text-muted)] hover:text-[var(--text-main)]"
            }`}
          >
            {getFilterLabel(filter)}
          </button>
        ))}
      </div>
    </div>
  );
}
