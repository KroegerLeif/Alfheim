"use client";

import { useTranslation } from "@loeger-os/shared";
import { LocationRead } from "@/features/locations/types";
import { ProductRead } from "@/features/products/types";

interface LedgerFilterBarProps {
  filterProductId: string;
  onProductChange: (v: string) => void;
  filterLocationId: string;
  onLocationChange: (v: string) => void;
  products: ProductRead[];
  locations: LocationRead[];
}

/**
 * LedgerFilterBar
 * Renders product and location dropdown filters for the ledger history view.
 */
export function LedgerFilterBar({
  filterProductId, onProductChange,
  filterLocationId, onLocationChange,
  products, locations,
}: LedgerFilterBarProps) {
  const { t } = useTranslation();

  return (
    <div className="flex flex-col md:flex-row gap-4">
      <select value={filterProductId} onChange={(e) => onProductChange(e.target.value)}
        className="py-2.5 px-3 border border-[var(--border-subtle)] bg-[var(--surface-card)] text-[var(--text-main)] focus:outline-none focus:border-[var(--primary-main)] text-xs uppercase h-11 min-w-[220px] cursor-pointer rounded">
        <option value="">{t("pantry.filterByProduct")}</option>
        {products.map((p) => <option key={p.id} value={p.id}>{p.name.toUpperCase()}</option>)}
      </select>
      <select value={filterLocationId} onChange={(e) => onLocationChange(e.target.value)}
        className="py-2.5 px-3 border border-[var(--border-subtle)] bg-[var(--surface-card)] text-[var(--text-main)] focus:outline-none focus:border-[var(--primary-main)] text-xs uppercase h-11 min-w-[220px] cursor-pointer rounded">
        <option value="">{t("pantry.filterByLocation")}</option>
        {locations.map((loc) => <option key={loc.id} value={loc.id}>{loc.name.toUpperCase()}</option>)}
      </select>
    </div>
  );
}
