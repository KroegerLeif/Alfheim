import React from "react";
import { useTranslation } from "@alfheim/shared";
import { MediaItem } from "../types";
import { ItemCard } from "./ItemCard";

interface CatalogGridProps {
  items: MediaItem[];
  isLoading: boolean;
  locationsMap: Map<string, string>;
}

export function CatalogGrid({
  items,
  isLoading,
  locationsMap,
}: CatalogGridProps) {
  const { t } = useTranslation();

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {Array.from({ length: 8 }).map((_, idx) => (
          <div
            key={idx}
            className="h-64 rounded-2xl border border-[var(--border-subtle,#334155)] bg-[var(--surface-card,#1e293b)] animate-pulse p-4 flex flex-col justify-between space-y-3"
          >
            <div className="aspect-[16/9] w-full rounded-xl bg-[var(--surface-muted,#0f172a)]" />
            <div className="space-y-2">
              <div className="h-4 w-3/4 rounded bg-[var(--surface-muted,#0f172a)]" />
              <div className="h-3 w-1/2 rounded bg-[var(--surface-muted,#0f172a)]" />
            </div>
            <div className="h-3 w-1/3 rounded bg-[var(--surface-muted,#0f172a)]" />
          </div>
        ))}
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-[var(--border-main,#334155)] p-12 text-center my-6">
        <div className="h-12 w-12 rounded-full bg-[var(--surface-card,#1e293b)] flex items-center justify-center text-xl mb-3">
          📚
        </div>
        <h3 className="text-base font-bold text-[var(--text-main,#f8fafc)]">
          {t("library.catalog.noItemsFound")}
        </h3>
        <p className="text-xs text-[var(--text-muted,#64748b)] max-w-sm mt-1">
          {t("library.catalog.subtitle")}
        </p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
      {items.map((item) => (
        <ItemCard
          key={item.id}
          item={item}
          locationName={item.location_id ? locationsMap.get(item.location_id) : undefined}
        />
      ))}
    </div>
  );
}
