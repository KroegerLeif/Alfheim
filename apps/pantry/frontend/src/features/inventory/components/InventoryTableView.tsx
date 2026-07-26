"use client";

import * as React from "react";
import { useTranslation } from "@loeger-os/shared";
import { useInventoryState } from "@/features/inventory/services/inventoryService";
import { useLocations } from "@/features/locations/services/locationService";
import { useCategories } from "@/features/categories/services/categoryService";
import { StockActionModal } from "./StockActionModal";
import { 
  Table, 
  TableHeader, 
  TableBody, 
  TableRow, 
  TableHead, 
  TableCell 
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { ProductRead } from "@/features/inventory/types";
import { Search, Plus, Minus, AlertTriangle, RefreshCw } from "lucide-react";

/**
 * InventoryTableView Component
 * Displays a tabular inventory overview tracking stock states.
 * Allows quick action logs (+ IN / - OUT) on a specific product.
 * Triggers warnings (amber/red) when stock drops below product minimums.
 */
export function InventoryTableView() {
  const { t } = useTranslation();
  
  // Queries
  const { data: states = [], isLoading: isLoadingStates, refetch } = useInventoryState();
  const { data: locations = [] } = useLocations();
  const { data: categories = [] } = useCategories();

  // Filters State
  const [searchQuery, setSearchQuery] = React.useState("");
  const [selectedLocationId, setSelectedLocationId] = React.useState("");
  const [selectedCategoryId, setSelectedCategoryId] = React.useState("");

  // Modal Control State
  const [isModalOpen, setIsModalOpen] = React.useState(false);
  const [modalMode, setModalMode] = React.useState<"in" | "out">("in");
  const [selectedProduct, setSelectedProduct] = React.useState<ProductRead | null>(null);

  const handleQuickAction = (product: ProductRead, mode: "in" | "out") => {
    setSelectedProduct(product);
    setModalMode(mode);
    setIsModalOpen(true);
  };

  // Perform client-side filter computation
  const filteredStates = React.useMemo(() => {
    return states.filter((state) => {
      const product = state.product;
      if (!product) return false;

      // 1. Search Query filter (matches product name or barcode)
      const matchesSearch = 
        product.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (product.barcode && product.barcode.includes(searchQuery));

      // 2. Location filter
      const matchesLocation = 
        !selectedLocationId || state.location_id === selectedLocationId;

      // 3. Category filter
      const matchesCategory = 
        !selectedCategoryId || product.category_id === selectedCategoryId;

      return matchesSearch && matchesLocation && matchesCategory;
    });
  }, [states, searchQuery, selectedLocationId, selectedCategoryId]);

  return (
    <div className="flex-1 p-6 md:p-12 space-y-6 max-w-7xl mx-auto w-full select-none text-[var(--text-main)] font-mono">
      
      {/* Page Title */}
      <header className="border-b border-[var(--border-subtle)] pb-4 flex justify-between items-baseline gap-4">
        <div>
          <h1 className="text-4xl font-heading font-black tracking-wide text-[var(--text-main)] uppercase">
            {t("pantry.stockInventory")}
          </h1>
          <p className="font-mono text-xs text-[var(--text-muted)] mt-1 uppercase tracking-wider">
            {t("pantry.stockInventorySub")}
          </p>
        </div>
        <Button 
          variant="outline" 
          size="sm" 
          onClick={() => refetch()} 
          className="h-8 text-xs font-mono uppercase tracking-wider gap-1 cursor-pointer border-[var(--border-subtle)] hover:bg-[var(--surface-elevated)]"
        >
          <RefreshCw className="h-3 w-3" />
          {t("pantry.refresh")}
        </Button>
      </header>

      {/* FILTER BAR PANEL */}
      <div className="flex flex-col md:flex-row gap-4 font-mono">
        
        {/* Search input field */}
        <div className="relative flex-1">
          <Search className="absolute left-3 top-3.5 h-4 w-4 text-[var(--text-muted)]" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={t("pantry.searchPlaceholder")}
            className="w-full pl-9 pr-4 py-3 border border-[var(--border-subtle)] bg-[var(--surface-card)] text-[var(--text-main)] focus:outline-none focus:border-[var(--primary-main)] text-sm h-11 rounded"
          />
        </div>

        {/* Category dropdown filters */}
        <select
          value={selectedCategoryId}
          onChange={(e) => setSelectedCategoryId(e.target.value)}
          className="py-2.5 px-3 border border-[var(--border-subtle)] bg-[var(--surface-card)] text-[var(--text-main)] focus:outline-none focus:border-[var(--primary-main)] text-xs uppercase h-11 min-w-[180px] cursor-pointer rounded"
        >
          <option value="">{t("pantry.filterCategory")}</option>
          {categories.map((cat) => (
            <option key={cat.id} value={cat.id}>
              {cat.name.toUpperCase()}
            </option>
          ))}
        </select>

        {/* Location dropdown filters */}
        <select
          value={selectedLocationId}
          onChange={(e) => setSelectedLocationId(e.target.value)}
          className="py-2.5 px-3 border border-[var(--border-subtle)] bg-[var(--surface-card)] text-[var(--text-main)] focus:outline-none focus:border-[var(--primary-main)] text-xs uppercase h-11 min-w-[180px] cursor-pointer rounded"
        >
          <option value="">{t("pantry.filterLocation")}</option>
          {locations.map((loc) => (
            <option key={loc.id} value={loc.id}>
              {loc.name.toUpperCase()}
            </option>
          ))}
        </select>

      </div>

      {/* TABLE BOX */}
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
            {isLoadingStates ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-10 text-xs text-[var(--text-muted)] uppercase">
                  {t("pantry.loadingRegisters")}
                </TableCell>
              </TableRow>
            ) : filteredStates.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-10 text-xs text-[var(--text-muted)] uppercase">
                  [ {t("pantry.noItems")} ]
                </TableCell>
              </TableRow>
            ) : (
              filteredStates.map((state) => {
                const product = state.product!;
                const location = state.location!;
                
                const isExpired = state.expiration_date && new Date(state.expiration_date).getTime() < new Date().getTime();
                const isEmpty = state.quantity <= 0;
                const isLowStock = !isEmpty && state.quantity < product.minimum_stock;

                return (
                  <TableRow key={state.id} className="border-b border-[var(--border-subtle)] last:border-b-0 hover:bg-[var(--surface-elevated)]/50">
                    {/* Product Identifier info */}
                    <TableCell className="font-sans">
                      <div className="font-bold uppercase text-sm tracking-tight text-[var(--text-main)]">
                        {product.name}
                      </div>
                      {product.brand && (
                        <div className="text-[10px] text-[var(--text-muted)] uppercase tracking-wider mt-0.5 font-mono">
                          {product.brand}
                        </div>
                      )}
                    </TableCell>

                    {/* Target Storage Location */}
                    <TableCell className="uppercase text-[var(--text-main)] font-mono text-xs">
                      {location.name}
                    </TableCell>

                    {/* Stock level cell with alerts */}
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1.5 font-bold font-mono">
                        {isLowStock && <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />}
                        <span className={
                          isEmpty
                            ? "text-red-500 font-black"
                            : isLowStock
                            ? "text-amber-500 font-bold"
                            : "text-[var(--text-main)]"
                        }>
                          {state.quantity.toFixed(1)}
                        </span>
                        <span className="text-[10px] text-[var(--text-muted)] font-normal uppercase">
                          {product.base_unit}
                        </span>
                      </div>
                    </TableCell>

                    {/* Expirations */}
                    <TableCell className="font-mono text-xs">
                      {state.expiration_date ? (
                        <span className={isExpired ? "text-red-500 font-bold" : "text-[var(--text-main)]"}>
                          {state.expiration_date}
                          {isExpired && ` [${t("pantry.expired")}]`}
                        </span>
                      ) : (
                        <span className="text-[var(--text-muted)] font-normal">--</span>
                      )}
                    </TableCell>

                    {/* Row quick actions */}
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        {/* Quick Stock In */}
                        <Button
                          onClick={() => handleQuickAction(product, "in")}
                          variant="outline"
                          size="sm"
                          className="h-8 text-[10px] px-2.5 font-black uppercase tracking-wider text-emerald-400 border-emerald-800/40 bg-emerald-950/20 hover:bg-emerald-900/40 cursor-pointer"
                        >
                          <Plus className="h-3 w-3 mr-0.5" />
                          {t("pantry.actionIn")}
                        </Button>

                        {/* Quick Stock Out */}
                        <Button
                          onClick={() => handleQuickAction(product, "out")}
                          variant="outline"
                          size="sm"
                          className="h-8 text-[10px] px-2.5 font-black uppercase tracking-wider text-red-400 border-red-800/40 bg-red-950/20 hover:bg-red-900/40 cursor-pointer"
                        >
                          <Minus className="h-3 w-3 mr-0.5" />
                          {t("pantry.actionOut")}
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      {/* DIALOG MODALS */}
      <StockActionModal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setSelectedProduct(null);
        }}
        mode={modalMode}
        preselectedProduct={selectedProduct}
      />

    </div>
  );
}
