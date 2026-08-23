"use client";

import * as React from "react";
import { useTranslation } from "@alfheim/shared";
import { useLocations } from "../services/locationService";
import { useInventoryState, useLowStockItems } from "@/features/inventory/services/inventoryService";
import { Button } from "@alfheim/shared";
import { Plus, Minus, Loader2, Check } from "lucide-react";
import { LocationCard } from "./LocationCard";
import { LocationCreateForm } from "./LocationCreateForm";

/**
 * LocationsGridView
 * Orchestrates the storage location management panel:
 * - Header with toggle-able LocationCreateForm
 * - LocationCard grid with live alarm metrics
 */
export function LocationsGridView() {
  const { t } = useTranslation();
  const [isFormOpen, setIsFormOpen] = React.useState(false);
  const [successMessage, setSuccessMessage] = React.useState<string | null>(null);

  const { data: locations = [], isLoading: isLoadingLocs, isError: isLocsError } = useLocations();
  const { data: states = [], isLoading: isLoadingStates, isError: isStatesError } = useInventoryState();
  const { data: lowStockItems = [], isLoading: isLoadingLowStock, isError: isLowStockError } = useLowStockItems();

  const todayStr = new Date().toISOString().split("T")[0];

  const lowStockProductIds = React.useMemo(
    () => new Set(lowStockItems.map((item) => item.product.id)),
    [lowStockItems]
  );

  const isLoadingData = isLoadingLocs || isLoadingStates || isLoadingLowStock;
  const isErrorData = isLocsError || isStatesError || isLowStockError;

  const handleCreateSuccess = () => {
    setIsFormOpen(false);
    setSuccessMessage(t("pantry.locationSuccess"));
    setTimeout(() => setSuccessMessage(null), 4000);
  };

  return (
    <div className="flex-1 flex flex-col min-w-0 bg-[var(--surface-canvas)] text-[var(--text-main)] font-mono p-8 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-[var(--border-subtle)] pb-6 gap-4">
        <div>
          <h1 className="text-4xl font-heading font-black tracking-wide leading-none select-none text-[var(--text-main)]">{t("pantry.locationsTitle")}</h1>
          <p className="uppercase tracking-widest text-[10px] text-[var(--text-muted)] mt-2 font-mono">{t("pantry.locationsSub")}</p>
        </div>
        <Button id="toggle-create-location" onClick={() => setIsFormOpen(!isFormOpen)} variant="outline"
          className="py-6 px-6 font-black tracking-widest border-2 border-[var(--border-accent)] bg-[var(--surface-card)] text-[var(--primary-main)] hover:bg-[var(--primary-main)] hover:text-black cursor-pointer select-none transition-all h-12 flex items-center justify-center gap-2 self-start rounded-lg">
          {isFormOpen ? <><Minus className="h-4 w-4" />{t("pantry.createBtnClose")}</> : <><Plus className="h-4 w-4" />{t("pantry.createBtn")}</>}
        </Button>
      </div>

      {isFormOpen && (
        <LocationCreateForm
          onSuccess={handleCreateSuccess}
          onCancel={() => setIsFormOpen(false)}
        />
      )}

      {successMessage && !isFormOpen && (
        <div className="border border-emerald-800/40 bg-emerald-950/20 text-emerald-400 p-3 text-xs flex items-start gap-2 uppercase font-bold leading-normal max-w-xl rounded">
          <Check className="h-4 w-4 shrink-0 mt-0.5" /><span>{successMessage}</span>
        </div>
      )}

      {isErrorData && (
        <div className="border border-rose-800/40 bg-rose-950/20 text-rose-400 p-4 text-xs font-bold uppercase rounded-lg">
          Failed to load storage locations or inventory data. Please refresh or try again later.
        </div>
      )}

      {isLoadingData ? (
        <div className="flex items-center justify-center py-20 gap-3">
          <Loader2 className="h-5 w-5 animate-spin text-[var(--primary-main)]" />
          <span className="text-xs uppercase font-bold tracking-widest text-[var(--text-muted)]">{t("pantry.loadingRegisters")}</span>
        </div>
      ) : locations.length === 0 ? (
        <div className="border border-dashed border-[var(--border-subtle)] p-12 text-center text-xs text-[var(--text-muted)] uppercase tracking-widest rounded-lg">
          {t("pantry.noLocations")}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {locations.map((loc) => {
            const locStates = states.filter((s) => s.location_id === loc.id);
            const expiredCount = locStates.filter((s) => s.expiration_date && s.expiration_date <= todayStr).length;
            const knappCount = new Set(locStates.filter((s) => lowStockProductIds.has(s.product_id)).map((s) => s.product_id)).size;
            return <LocationCard key={loc.id} location={loc} expiredCount={expiredCount} knappCount={knappCount} />;
          })}
        </div>
      )}
    </div>
  );
}
