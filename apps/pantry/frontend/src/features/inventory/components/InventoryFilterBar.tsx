"use client";

import { useTranslation } from "@alfheim/shared";
import { Search } from "lucide-react";
import { LocationRead } from "@/features/locations/types";
import { CategoryRead } from "@/features/categories/types";

interface InventoryFilterBarProps {
  searchQuery: string;
  onSearchChange: (v: string) => void;
  selectedCategoryId: string;
  onCategoryChange: (v: string) => void;
  selectedLocationId: string;
  onLocationChange: (v: string) => void;
  categories: CategoryRead[];
  locations: LocationRead[];
}

/**
 * InventoryFilterBar
 * Renders the search input and category/location dropdowns for inventory filtering.
 */
export function InventoryFilterBar({
  searchQuery, onSearchChange,
  selectedCategoryId, onCategoryChange,
  selectedLocationId, onLocationChange,
  categories, locations,
}: InventoryFilterBarProps) {
  const { t } = useTranslation();

  return (
    <div className="flex flex-col md:flex-row gap-4 font-mono">
      <div className="relative flex-1">
        <Search className="absolute left-3 top-3.5 h-4 w-4 text-[var(--text-muted)]" />
        <input type="text" value={searchQuery} onChange={(e) => onSearchChange(e.target.value)}
          placeholder={t("pantry.searchPlaceholder")}
          className="w-full pl-9 pr-4 py-3 border border-[var(--border-subtle)] bg-[var(--surface-card)] text-[var(--text-main)] focus:outline-none focus:border-[var(--primary-main)] text-sm h-11 rounded" />
      </div>
      <select aria-label={t("pantry.filterCategory")} value={selectedCategoryId} onChange={(e) => onCategoryChange(e.target.value)}
        className="py-2.5 px-3 border border-[var(--border-subtle)] bg-[var(--surface-card)] text-[var(--text-main)] focus:outline-none focus:border-[var(--primary-main)] text-xs uppercase h-11 min-w-[180px] cursor-pointer rounded">
        <option value="">{t("pantry.filterCategory")}</option>
        {categories.map((cat) => <option key={cat.id} value={cat.id}>{cat.name.toUpperCase()}</option>)}
      </select>
      <select aria-label={t("pantry.filterLocation")} value={selectedLocationId} onChange={(e) => onLocationChange(e.target.value)}
        className="py-2.5 px-3 border border-[var(--border-subtle)] bg-[var(--surface-card)] text-[var(--text-main)] focus:outline-none focus:border-[var(--primary-main)] text-xs uppercase h-11 min-w-[180px] cursor-pointer rounded">
        <option value="">{t("pantry.filterLocation")}</option>
        {locations.map((loc) => <option key={loc.id} value={loc.id}>{loc.name.toUpperCase()}</option>)}
      </select>
    </div>
  );
}
