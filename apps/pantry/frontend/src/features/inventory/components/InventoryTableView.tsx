"use client";

import * as React from "react";
import { useTranslation } from "@alfheim/shared";
import { useInventoryState } from "@/features/inventory/services/inventoryService";
import { useLocations } from "@/features/locations/services/locationService";
import { useCategories } from "@/features/categories/services/categoryService";
import { StockActionModal } from "./StockActionModal";
import { InventoryFilterBar } from "./InventoryFilterBar";
import { InventoryTableRow } from "./InventoryTableRow";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { RefreshCw } from "lucide-react";
import { ProductRead } from "@/features/products/types";

/**
 * InventoryTableView
 * Orchestrates the inventory stock table:
 * - InventoryFilterBar (search + category/location dropdowns)
 * - InventoryTableRow per filtered state record
 * - StockActionModal for quick IN/OUT transactions
 */
export function InventoryTableView() {
  const { t } = useTranslation();

  const { data: states = [], isLoading, isError, refetch } = useInventoryState();
  const { data: locations = [] } = useLocations();
  const { data: categories = [] } = useCategories();

  const [searchQuery, setSearchQuery] = React.useState("");
  const [selectedLocationId, setSelectedLocationId] = React.useState("");
  const [selectedCategoryId, setSelectedCategoryId] = React.useState("");

  const [isModalOpen, setIsModalOpen] = React.useState(false);
  const [modalMode, setModalMode] = React.useState<"in" | "out">("in");
  const [selectedProduct, setSelectedProduct] = React.useState<ProductRead | null>(null);

  const filteredStates = React.useMemo(() =>
    states.filter((state) => {
      const product = state.product;
      if (!product) return false;
      const matchesSearch =
        product.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (product.barcode && product.barcode.includes(searchQuery));
      return (
        matchesSearch &&
        (!selectedLocationId || state.location_id === selectedLocationId) &&
        (!selectedCategoryId || product.category_id === selectedCategoryId)
      );
    }),
    [states, searchQuery, selectedLocationId, selectedCategoryId]
  );

  const handleQuickAction = (product: ProductRead, mode: "in" | "out") => {
    setSelectedProduct(product);
    setModalMode(mode);
    setIsModalOpen(true);
  };

  return (
    <div className="flex-1 p-6 md:p-12 space-y-6 max-w-7xl mx-auto w-full select-none text-[var(--text-main)] font-mono">
      <header className="border-b border-[var(--border-subtle)] pb-4 flex justify-between items-baseline gap-4">
        <div>
          <h1 className="text-4xl font-heading font-black tracking-wide text-[var(--text-main)] uppercase">{t("pantry.stockInventory")}</h1>
          <p className="font-mono text-xs text-[var(--text-muted)] mt-1 uppercase tracking-wider">{t("pantry.stockInventorySub")}</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => refetch()}
          className="h-8 text-xs font-mono uppercase tracking-wider gap-1 cursor-pointer border-[var(--border-subtle)] hover:bg-[var(--surface-elevated)]">
          <RefreshCw className="h-3 w-3" />{t("pantry.refresh")}
        </Button>
      </header>

      <InventoryFilterBar
        searchQuery={searchQuery} onSearchChange={setSearchQuery}
        selectedCategoryId={selectedCategoryId} onCategoryChange={setSelectedCategoryId}
        selectedLocationId={selectedLocationId} onLocationChange={setSelectedLocationId}
        categories={categories} locations={locations}
      />

      <div className="border border-[var(--border-subtle)] bg-[var(--surface-card)] rounded-lg shadow-sm">
        <Table>
          <TableHeader>
            <TableRow className="border-b border-[var(--border-subtle)]">
              <TableHead className="w-[30%] text-[var(--text-muted)]">{t("pantry.product")}</TableHead>
              <TableHead className="w-[20%] text-[var(--text-muted)]">{t("pantry.location")}</TableHead>
              <TableHead className="w-[15%] text-right text-[var(--text-muted)]">{t("pantry.quantity")}</TableHead>
              <TableHead className="w-[18%] text-[var(--text-muted)]">{t("pantry.expiration")}</TableHead>
              <TableHead className="w-[17%] text-right text-[var(--text-muted)]">{t("pantry.actions")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isError ? (
              <TableRow><TableCell colSpan={7} className="text-center py-12 text-xs font-bold text-rose-400 uppercase">Failed to load inventory stock levels.</TableCell></TableRow>
            ) : isLoading ? (
              <TableRow><TableCell colSpan={5} className="text-center py-10 text-xs text-[var(--text-muted)] uppercase">{t("pantry.loadingRegisters")}</TableCell></TableRow>
            ) : filteredStates.length === 0 ? (
              <TableRow><TableCell colSpan={5} className="text-center py-10 text-xs text-[var(--text-muted)] uppercase">[ {t("pantry.noItems")} ]</TableCell></TableRow>
            ) : (
              filteredStates.map((state) => (
                <InventoryTableRow
                  key={state.id}
                  state={state}
                  onQuickAction={(mode) => state.product && handleQuickAction(state.product, mode)}
                />
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <StockActionModal
        isOpen={isModalOpen}
        onClose={() => { setIsModalOpen(false); setSelectedProduct(null); }}
        mode={modalMode}
        preselectedProduct={selectedProduct}
      />
    </div>
  );
}
