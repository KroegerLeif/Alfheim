"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
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
  const t = useTranslations("Table");
  
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
    <div className="flex-1 p-6 md:p-12 space-y-6 max-w-7xl mx-auto w-full select-none">
      
      {/* Page Title */}
      <header className="border-b border-border pb-4 flex justify-between items-baseline gap-4">
        <div>
          <h1 className="text-4xl font-heading font-black tracking-wide text-foreground uppercase">
            Stock Inventory
          </h1>
          <p className="font-mono text-xs text-muted-foreground mt-1 uppercase tracking-wider">
            Real-time physical inventory control table
          </p>
        </div>
        <Button 
          variant="outline" 
          size="sm" 
          onClick={() => refetch()} 
          className="h-8 text-xs font-mono uppercase tracking-wider gap-1 cursor-pointer"
        >
          <RefreshCw className="h-3 w-3" />
          Refresh
        </Button>
      </header>

      {/* FILTER BAR PANEL */}
      <div className="flex flex-col md:flex-row gap-4 font-mono">
        
        {/* Search input field */}
        <div className="relative flex-1">
          <Search className="absolute left-3 top-3.5 h-4 w-4 text-neutral-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={t("searchPlaceholder")}
            className="w-full pl-9 pr-4 py-3 border border-border bg-background focus:outline-none focus:ring-1 focus:ring-ring text-sm h-11"
          />
        </div>

        {/* Category dropdown filters */}
        <select
          value={selectedCategoryId}
          onChange={(e) => setSelectedCategoryId(e.target.value)}
          className="py-2.5 px-3 border border-border bg-background focus:outline-none focus:ring-1 focus:ring-ring text-xs uppercase h-11 min-w-[180px] cursor-pointer"
        >
          <option value="">{t("filterCategory")}</option>
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
          className="py-2.5 px-3 border border-border bg-background focus:outline-none focus:ring-1 focus:ring-ring text-xs uppercase h-11 min-w-[180px] cursor-pointer"
        >
          <option value="">{t("filterLocation")}</option>
          {locations.map((loc) => (
            <option key={loc.id} value={loc.id}>
              {loc.name.toUpperCase()}
            </option>
          ))}
        </select>

      </div>

      {/* TABLE BOX */}
      <div className="border border-border bg-background">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[30%]">{t("product")}</TableHead>
              <TableHead className="w-[20%]">{t("location")}</TableHead>
              <TableHead className="w-[15%] text-right">{t("quantity")}</TableHead>
              <TableHead className="w-[18%]">{t("expiration")}</TableHead>
              <TableHead className="w-[17%] text-right">{t("actions")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoadingStates ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-10 text-xs text-muted-foreground uppercase">
                  Loading inventory registers...
                </TableCell>
              </TableRow>
            ) : filteredStates.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-10 text-xs text-neutral-400 uppercase">
                  [ {t("noItems")} ]
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
                  <TableRow key={state.id}>
                    {/* Product Identifier info */}
                    <TableCell className="font-sans">
                      <div className="font-bold uppercase text-sm tracking-tight text-foreground">
                        {product.name}
                      </div>
                      {product.brand && (
                        <div className="text-[10px] text-muted-foreground uppercase tracking-wider mt-0.5">
                          {product.brand}
                        </div>
                      )}
                    </TableCell>

                    {/* Target Storage Location */}
                    <TableCell className="uppercase">
                      {location.name}
                    </TableCell>

                    {/* Stock level cell with alerts */}
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1.5 font-bold">
                        {isLowStock && <AlertTriangle className="h-3.5 w-3.5 text-amber-600" />}
                        <span className={
                          isEmpty
                            ? "text-red-600 font-black"
                            : isLowStock
                            ? "text-amber-600 font-bold"
                            : "text-foreground"
                        }>
                          {state.quantity.toFixed(1)}
                        </span>
                        <span className="text-[10px] text-muted-foreground font-normal uppercase">
                          {product.base_unit}
                        </span>
                      </div>
                    </TableCell>

                    {/* Expirations */}
                    <TableCell>
                      {state.expiration_date ? (
                        <span className={isExpired ? "text-red-600 font-bold" : "text-foreground"}>
                          {state.expiration_date}
                          {isExpired && " [EXPIRED]"}
                        </span>
                      ) : (
                        <span className="text-neutral-300 font-normal">--</span>
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
                          className="h-8 text-[10px] px-2.5 font-black uppercase tracking-wider text-emerald-800 hover:bg-emerald-50 hover:border-emerald-600 cursor-pointer"
                        >
                          <Plus className="h-3 w-3 mr-0.5" />
                          IN
                        </Button>

                        {/* Quick Stock Out */}
                        <Button
                          onClick={() => handleQuickAction(product, "out")}
                          variant="outline"
                          size="sm"
                          className="h-8 text-[10px] px-2.5 font-black uppercase tracking-wider text-red-800 hover:bg-red-50 hover:border-red-600 cursor-pointer"
                        >
                          <Minus className="h-3 w-3 mr-0.5" />
                          OUT
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
