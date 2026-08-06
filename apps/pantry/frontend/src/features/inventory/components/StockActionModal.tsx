"use client";

import * as React from "react";
import { useTranslation } from "@loeger-os/shared";
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogDescription,
  DialogFooter 
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useLocations } from "@/features/locations/services/locationService";
import { useSearchProducts, useCreateProduct } from "@/features/products/services/productService";
import { useCategories, useCreateCategory } from "@/features/categories/services/categoryService";
import { useCreateTransaction } from "@/features/inventory/services/inventoryService";
import { pantryClient } from "@/core/api";
import { ProductRead } from "@/features/inventory/types";
import { Search, Barcode, Plus, Minus, Check, Loader2, AlertCircle, PackagePlus } from "lucide-react";

interface StockActionModalProps {
  isOpen: boolean;
  onClose: () => void;
  mode: "in" | "out";
  preselectedProduct?: ProductRead | null;
}

/**
 * StockActionModal Component
 * Facilitates recording physical stock transactions (IN / OUT movements).
 * Provides a barcode reader and a manual registry search.
 * Supports quick inline creation of missing product blueprints & categories.
 * Incorporates a touch-stepper for fast tablet-based quantity logging.
 */
export function StockActionModal({ isOpen, onClose, mode, preselectedProduct = null }: StockActionModalProps) {
  const { t } = useTranslation();
  const [productQuery, setProductQuery] = React.useState("");
  const [selectedProduct, setSelectedProduct] = React.useState<ProductRead | null>(null);
  const [selectedLocationId, setSelectedLocationId] = React.useState<string>("");
  
  // Inline quick product creation state
  const [isCreatingProduct, setIsCreatingProduct] = React.useState(false);
  const [newProductName, setNewProductName] = React.useState("");
  const [newProductBrand, setNewProductBrand] = React.useState("");
  const [newProductBarcode, setNewProductBarcode] = React.useState("");
  const [newProductBaseUnit, setNewProductBaseUnit] = React.useState("piece");
  const [newProductMinStock, setNewProductMinStock] = React.useState<number>(0);
  const [newProductCategoryId, setNewProductCategoryId] = React.useState("");

  // Inline quick category creation state
  const [isCreatingCategory, setIsCreatingCategory] = React.useState(false);
  const [newCategoryName, setNewCategoryName] = React.useState("");

  // Transaction entry fields
  const [quantity, setQuantity] = React.useState<number>(1);
  const [unit, setUnit] = React.useState<string>("");
  const [batchCode, setBatchCode] = React.useState<string>("");
  const [expirationDate, setExpirationDate] = React.useState<string>("");
  const [notes, setNotes] = React.useState<string>("");
  const [barcodeInput, setBarcodeInput] = React.useState<string>("");
  const [scanError, setScanError] = React.useState<string>("");

  // Queries & mutations
  const { data: locations = [], isLoading: isLoadingLocs } = useLocations();
  const { data: categories = [] } = useCategories();
  const { data: searchResults = [], isLoading: isSearchingProducts } = useSearchProducts(productQuery);
  
  const createTransactionMut = useCreateTransaction();
  const createProductMut = useCreateProduct();
  const createCategoryMut = useCreateCategory();

  // Reset local state variables when modal status changes
  React.useEffect(() => {
    if (isOpen) {
      if (preselectedProduct) {
        setSelectedProduct(preselectedProduct);
      }
    } else {
      setProductQuery("");
      setSelectedProduct(null);
      setSelectedLocationId("");
      setQuantity(1);
      setUnit("");
      setBatchCode("");
      setExpirationDate("");
      setNotes("");
      setBarcodeInput("");
      setScanError("");
      setIsCreatingProduct(false);
      setIsCreatingCategory(false);
      setNewProductName("");
      setNewProductBrand("");
      setNewProductBarcode("");
      setNewProductBaseUnit("piece");
      setNewProductMinStock(0);
      setNewProductCategoryId("");
      setNewCategoryName("");
    }
  }, [isOpen, preselectedProduct]);

  // Handle location auto-selection (fall back to the standard 'backlog' system location, or first index)
  React.useEffect(() => {
    if (locations.length > 0 && !selectedLocationId) {
      const systemBacklog = locations.find(loc => loc.is_system && loc.name.toLowerCase() === "backlog") || locations[0];
      setSelectedLocationId(systemBacklog.id);
    }
  }, [locations, selectedLocationId]);

  // Sync unit with product's default base unit on selection
  React.useEffect(() => {
    if (selectedProduct) {
      setUnit(selectedProduct.base_unit || "piece");
    }
  }, [selectedProduct]);

  // Handle scanning of physical barcodes
  const handleBarcodeSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!barcodeInput.trim()) return;
    
    setScanError("");
    try {
      const data = await pantryClient
        .get(`api/v1/products/barcode/${barcodeInput}`)
        .json<ProductRead>();
      setSelectedProduct(data);
      setBarcodeInput("");
    } catch (err: any) {
      setScanError(t("pantry.noMatchesFound"));
    }
  };

  const handleProductSelect = (product: ProductRead) => {
    setSelectedProduct(product);
    setProductQuery("");
    setIsCreatingProduct(false);
  };

  const handleOpenInlineProductCreation = () => {
    setIsCreatingProduct(true);
    setNewProductName(productQuery.trim());
    setNewProductBarcode(barcodeInput.trim());
  };

  const handleCreateCategory = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCategoryName.trim()) return;

    createCategoryMut.mutate(
      { name: newCategoryName.trim() },
      {
        onSuccess: (newCat) => {
          setNewProductCategoryId(newCat.id);
          setIsCreatingCategory(false);
          setNewCategoryName("");
        },
      }
    );
  };

  const handleCreateProduct = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProductName.trim()) return;

    createProductMut.mutate(
      {
        name: newProductName.trim(),
        brand: newProductBrand.trim() || null,
        barcode: newProductBarcode.trim() || null,
        base_unit: newProductBaseUnit,
        minimum_stock: Number(newProductMinStock) || 0,
        category_id: newProductCategoryId || null,
        nutrition: null,
      },
      {
        onSuccess: (createdProduct) => {
          setSelectedProduct(createdProduct);
          setIsCreatingProduct(false);
          setProductQuery("");
          setBarcodeInput("");
        },
      }
    );
  };

  const adjustQuantity = (amount: number) => {
    setQuantity((prev) => Math.max(0.1, parseFloat((prev + amount).toFixed(2))));
  };

  const handleQuickPick = (amount: number) => {
    setQuantity(amount);
  };

  const handleSubmit = async () => {
    if (!selectedProduct || !selectedLocationId || !unit.trim()) return;

    createTransactionMut.mutate(
      {
        product_id: selectedProduct.id,
        location_id: selectedLocationId,
        transaction_type: mode,
        quantity_input: quantity,
        unit_input: unit,
        batch_code: batchCode.trim() || null,
        expiration_date: expirationDate || null,
        notes: notes.trim() || null,
      },
      {
        onSuccess: () => {
          onClose();
        },
      }
    );
  };

  const quickPicks = [1, 2, 3, 6, 12];

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto border border-[var(--border-subtle)] bg-[var(--surface-card)] text-[var(--text-main)] p-6 font-mono">
        <DialogHeader>
          <DialogTitle className="text-3xl font-heading font-black tracking-wide text-[var(--text-main)]">
            {mode === "in" ? t("pantry.transactionModalTitleIn") : t("pantry.transactionModalTitleOut")}
          </DialogTitle>
          <DialogDescription className="uppercase tracking-widest text-[10px] text-[var(--text-muted)] mt-1">
            {t("pantry.transactionModalSub")}
          </DialogDescription>
        </DialogHeader>

        {/* SELECT PRODUCT PANELS */}
        {!selectedProduct ? (
          <div className="space-y-6 my-4">
            {isCreatingProduct ? (
              /* INLINE QUICK PRODUCT CREATION FORM */
              <div className="border border-[var(--border-accent)] p-5 bg-[var(--surface-elevated)] space-y-4 rounded-lg">
                <div className="flex justify-between items-center border-b border-[var(--border-subtle)] pb-3">
                  <h3 className="font-heading font-bold text-lg uppercase flex items-center gap-2 text-[var(--primary-main)]">
                    <PackagePlus className="h-5 w-5" />
                    {t("pantry.createProductTitle")}
                  </h3>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setIsCreatingProduct(false)}
                    className="text-xs uppercase"
                  >
                    {t("pantry.cancel")}
                  </Button>
                </div>

                <form onSubmit={handleCreateProduct} className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="text-xs font-bold uppercase block">{t("pantry.productName")} *</label>
                      <input
                        type="text"
                        value={newProductName}
                        onChange={(e) => setNewProductName(e.target.value)}
                        placeholder="e.g. Organic Milk"
                        required
                        className="w-full p-2.5 border border-[var(--border-subtle)] bg-[var(--surface-canvas)] text-[var(--text-main)] text-sm rounded font-mono"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-bold uppercase block">{t("pantry.brand")}</label>
                      <input
                        type="text"
                        value={newProductBrand}
                        onChange={(e) => setNewProductBrand(e.target.value)}
                        placeholder="e.g. BioFarm"
                        className="w-full p-2.5 border border-[var(--border-subtle)] bg-[var(--surface-canvas)] text-[var(--text-main)] text-sm rounded font-mono"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="text-xs font-bold uppercase block">{t("pantry.barcode")}</label>
                      <input
                        type="text"
                        value={newProductBarcode}
                        onChange={(e) => setNewProductBarcode(e.target.value)}
                        placeholder="e.g. 40082345"
                        className="w-full p-2.5 border border-[var(--border-subtle)] bg-[var(--surface-canvas)] text-[var(--text-main)] text-sm rounded font-mono"
                      />
                    </div>
                    <div className="space-y-1">
                      <div className="flex justify-between items-center">
                        <label className="text-xs font-bold uppercase block">{t("pantry.category")}</label>
                        <button
                          type="button"
                          onClick={() => setIsCreatingCategory(!isCreatingCategory)}
                          className="text-[10px] text-[var(--primary-main)] hover:underline uppercase font-bold"
                        >
                          + {t("pantry.createCategoryTitle")}
                        </button>
                      </div>
                      
                      {isCreatingCategory ? (
                        <div className="flex gap-2">
                          <input
                            type="text"
                            value={newCategoryName}
                            onChange={(e) => setNewCategoryName(e.target.value)}
                            placeholder={t("pantry.categoryPlaceholder")}
                            className="flex-1 p-2 border border-[var(--border-subtle)] bg-[var(--surface-canvas)] text-xs text-[var(--text-main)] font-mono"
                          />
                          <Button
                            type="button"
                            onClick={handleCreateCategory}
                            disabled={createCategoryMut.isPending || !newCategoryName.trim()}
                            className="text-xs px-3 bg-[var(--primary-main)] text-black font-bold uppercase"
                          >
                            {createCategoryMut.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : t("common.save")}
                          </Button>
                        </div>
                      ) : (
                        <select
                          value={newProductCategoryId}
                          onChange={(e) => setNewProductCategoryId(e.target.value)}
                          className="w-full p-2.5 border border-[var(--border-subtle)] bg-[var(--surface-canvas)] text-[var(--text-main)] text-sm rounded uppercase font-mono"
                        >
                          <option value="">{t("pantry.filterCategory")}</option>
                          {categories.map((c) => (
                            <option key={c.id} value={c.id}>
                              {c.name.toUpperCase()}
                            </option>
                          ))}
                        </select>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="text-xs font-bold uppercase block">{t("pantry.baseUnit")}</label>
                      <select
                        value={newProductBaseUnit}
                        onChange={(e) => setNewProductBaseUnit(e.target.value)}
                        className="w-full p-2.5 border border-[var(--border-subtle)] bg-[var(--surface-canvas)] text-[var(--text-main)] text-sm rounded uppercase font-mono"
                      >
                        <option value="piece">{t("pantry.unitPiece")}</option>
                        <option value="g">{t("pantry.unitGrams")}</option>
                        <option value="ml">{t("pantry.unitMilliliters")}</option>
                        <option value="m">{t("pantry.unitMeters")}</option>
                      </select>
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-bold uppercase block">{t("pantry.minStockLabel")}</label>
                      <input
                        type="number"
                        min="0"
                        value={newProductMinStock}
                        onChange={(e) => setNewProductMinStock(parseFloat(e.target.value) || 0)}
                        className="w-full p-2.5 border border-[var(--border-subtle)] bg-[var(--surface-canvas)] text-[var(--text-main)] text-sm rounded font-mono"
                      />
                    </div>
                  </div>

                  <Button
                    type="submit"
                    disabled={createProductMut.isPending || !newProductName.trim()}
                    className="w-full py-3 bg-[var(--primary-main)] text-black hover:bg-[var(--primary-hover)] font-bold text-xs uppercase tracking-wider transition-all"
                  >
                    {createProductMut.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <>
                        <Check className="h-4 w-4 mr-2" />
                        {t("pantry.submitProduct")}
                      </>
                    )}
                  </Button>
                </form>
              </div>
            ) : (
              <>
                {/* Simulated Barcode scanning panel */}
                <form onSubmit={handleBarcodeSearch} className="border border-[var(--border-subtle)] p-4 bg-[var(--surface-elevated)] space-y-3 rounded-lg">
                  <label className="text-xs font-bold uppercase tracking-wider block text-[var(--text-main)]">
                    {t("pantry.simulateBarcode")}
                  </label>
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <Barcode className="absolute left-3 top-3.5 h-4 w-4 text-[var(--text-muted)]" />
                      <input
                        type="text"
                        value={barcodeInput}
                        onChange={(e) => setBarcodeInput(e.target.value)}
                        placeholder={t("pantry.eanPlaceholder")}
                        className="w-full pl-9 pr-4 py-3 border border-[var(--border-subtle)] bg-[var(--surface-canvas)] text-[var(--text-main)] focus:outline-none focus:border-[var(--primary-main)] text-sm rounded font-mono"
                      />
                    </div>
                    <Button type="submit" variant="outline" className="h-12 text-xs uppercase px-4 cursor-pointer">
                      {t("pantry.scanEAN")}
                    </Button>
                  </div>
                  {scanError && (
                    <div className="flex flex-col gap-2 mt-2">
                      <div className="text-xs text-red-400 font-semibold flex items-center gap-1.5">
                        <AlertCircle className="h-3.5 w-3.5" />
                        <span>{scanError}</span>
                      </div>
                      <Button
                        type="button"
                        onClick={handleOpenInlineProductCreation}
                        className="w-full py-2.5 bg-[var(--primary-main)] text-black font-bold text-xs uppercase hover:bg-[var(--primary-hover)] transition-all flex items-center justify-center gap-2"
                      >
                        <PackagePlus className="h-4 w-4" />
                        {t("pantry.createProductBtn")}
                      </Button>
                    </div>
                  )}
                </form>

                {/* Product text filter query */}
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <label className="text-xs font-bold uppercase tracking-wider block text-[var(--text-main)]">
                      {t("pantry.searchRegistry")}
                    </label>
                    <button
                      type="button"
                      onClick={handleOpenInlineProductCreation}
                      className="text-xs font-bold uppercase text-[var(--primary-main)] hover:underline flex items-center gap-1"
                    >
                      <PackagePlus className="h-3.5 w-3.5" />
                      + {t("pantry.createProductBtn")}
                    </button>
                  </div>
                  <div className="relative">
                    <Search className="absolute left-3 top-4 h-4 w-4 text-[var(--text-muted)]" />
                    <input
                      type="text"
                      value={productQuery}
                      onChange={(e) => setProductQuery(e.target.value)}
                      placeholder={t("pantry.typeProductName")}
                      className="w-full pl-9 pr-4 py-3.5 border border-[var(--border-subtle)] bg-[var(--surface-canvas)] text-[var(--text-main)] focus:outline-none focus:border-[var(--primary-main)] text-sm rounded font-mono"
                    />
                  </div>

                  {/* Reactive search list */}
                  {productQuery.trim().length > 0 && (
                    <div className="border border-[var(--border-subtle)] max-h-60 overflow-y-auto divide-y divide-[var(--border-subtle)] bg-[var(--surface-canvas)] mt-1 rounded">
                      {isSearchingProducts ? (
                        <div className="p-4 text-center text-xs text-[var(--text-muted)]">{t("pantry.searchingRegistry")}</div>
                      ) : searchResults.length === 0 ? (
                        <div className="p-4 flex flex-col items-center gap-3">
                          <span className="text-xs text-[var(--text-muted)]">{t("pantry.noMatchesFound")}</span>
                          <Button
                            type="button"
                            onClick={handleOpenInlineProductCreation}
                            className="py-2 px-4 bg-[var(--primary-main)] text-black font-bold text-xs uppercase hover:bg-[var(--primary-hover)] transition-all flex items-center gap-1.5"
                          >
                            <PackagePlus className="h-4 w-4" />
                            {t("pantry.createProductBtn")}
                          </Button>
                        </div>
                      ) : (
                        searchResults.map((product) => (
                          <button
                            key={product.id}
                            type="button"
                            onClick={() => handleProductSelect(product)}
                            className="w-full text-left p-4 hover:bg-[var(--surface-elevated)] flex items-center justify-between text-sm transition-all border-b border-[var(--border-subtle)] last:border-b-0 cursor-pointer"
                          >
                            <div>
                              <div className="font-bold uppercase tracking-tight text-[var(--text-main)]">{product.name}</div>
                              {product.brand && <div className="text-[10px] text-[var(--text-muted)] uppercase mt-0.5">{product.brand}</div>}
                            </div>
                            {product.barcode && (
                              <div className="font-mono text-xs text-[var(--text-muted)] bg-[var(--surface-elevated)] px-2 py-0.5 border border-[var(--border-subtle)] rounded">
                                {product.barcode}
                              </div>
                            )}
                          </button>
                        ))
                      )}
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        ) : (
          /* TRANSACTION DATA DETAILS FORM */
          <div className="space-y-5 my-4">
            {/* Selected product header panel */}
            <div className="border border-[var(--border-accent)] p-4 bg-[var(--surface-elevated)] text-[var(--text-main)] flex justify-between items-center rounded-lg">
              <div>
                <span className="text-[10px] uppercase font-bold tracking-widest text-[var(--text-muted)] block">{t("pantry.selectedItem")}</span>
                <h3 className="text-xl font-bold uppercase tracking-tight mt-1 text-[var(--primary-main)]">{selectedProduct.name}</h3>
                {selectedProduct.brand && (
                  <span className="text-xs uppercase text-[var(--text-muted)] mt-0.5 block">{selectedProduct.brand}</span>
                )}
              </div>
              <Button 
                onClick={() => setSelectedProduct(null)} 
                variant="outline" 
                className="text-[10px] h-8 px-3 border-[var(--border-subtle)] text-[var(--text-main)] hover:bg-[var(--surface-canvas)]"
              >
                {t("pantry.changeItem")}
              </Button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Storage Location selectors */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold uppercase tracking-wider block text-[var(--text-main)]">{t("pantry.targetLocation")}</label>
                <select
                  value={selectedLocationId}
                  onChange={(e) => setSelectedLocationId(e.target.value)}
                  className="w-full py-3 px-3 border border-[var(--border-subtle)] bg-[var(--surface-canvas)] text-[var(--text-main)] focus:outline-none focus:border-[var(--primary-main)] text-sm h-12 uppercase rounded"
                >
                  {isLoadingLocs ? (
                    <option>{t("pantry.loadingRegisters")}</option>
                  ) : (
                    locations.map((loc) => (
                      <option key={loc.id} value={loc.id}>
                        {loc.name.toUpperCase()} {loc.is_system ? `(${t("pantry.systemLocation").toUpperCase()})` : ""}
                      </option>
                    ))
                  )}
                </select>
              </div>

              {/* Units Input selector */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold uppercase tracking-wider block text-[var(--text-main)]">{t("pantry.unitOfMeasurement")}</label>
                <input
                  type="text"
                  value={unit}
                  onChange={(e) => setUnit(e.target.value)}
                  placeholder="e.g. piece, kg, g, l"
                  className="w-full py-3 px-3 border border-[var(--border-subtle)] bg-[var(--surface-canvas)] text-[var(--text-main)] focus:outline-none focus:border-[var(--primary-main)] text-sm h-12 uppercase font-mono rounded"
                />
              </div>
            </div>

            {/* Stepper Quantity selection box */}
            <div className="border border-[var(--border-subtle)] p-4 bg-[var(--surface-elevated)] space-y-4 rounded-lg">
              <label className="text-xs font-bold uppercase tracking-wider block text-center text-[var(--text-main)]">{t("pantry.transactionQuantity")}</label>
              
              <div className="flex items-center justify-center gap-4">
                <Button
                  type="button"
                  onClick={() => adjustQuantity(-1)}
                  variant="outline"
                  className="h-14 w-14 text-2xl font-black border border-[var(--border-subtle)] flex items-center justify-center p-0"
                >
                  <Minus className="h-5 w-5" />
                </Button>
                <input
                  type="number"
                  step="any"
                  value={quantity}
                  onChange={(e) => setQuantity(Math.max(0.1, parseFloat(parseFloat(e.target.value).toFixed(2)) || 1))}
                  className="w-32 h-14 border border-[var(--border-subtle)] bg-[var(--surface-canvas)] text-[var(--text-main)] text-center text-2xl font-black focus:outline-none focus:border-[var(--primary-main)] font-mono rounded"
                />
                <Button
                  type="button"
                  onClick={() => adjustQuantity(1)}
                  variant="outline"
                  className="h-14 w-14 text-2xl font-black border border-[var(--border-subtle)] flex items-center justify-center p-0"
                >
                  <Plus className="h-5 w-5" />
                </Button>
              </div>

              {/* Quick Picks quantity shortcut row */}
              <div className="flex justify-center gap-2 pt-2">
                {quickPicks.map((val) => (
                  <Button
                    key={val}
                    type="button"
                    onClick={() => handleQuickPick(val)}
                    variant={quantity === val ? "default" : "outline"}
                    className={`flex-1 py-4 text-xs font-black border h-10 ${
                      quantity === val
                        ? "bg-[var(--primary-main)] text-black border-[var(--primary-main)]"
                        : "border-[var(--border-subtle)] text-[var(--text-main)]"
                    }`}
                  >
                    {val}
                  </Button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Batch Codes */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold uppercase tracking-wider block text-[var(--text-main)]">{t("pantry.batchCodeOptional")}</label>
                <input
                  type="text"
                  value={batchCode}
                  onChange={(e) => setBatchCode(e.target.value)}
                  placeholder="e.g. BATCH-A4"
                  className="w-full py-3 px-3 border border-[var(--border-subtle)] bg-[var(--surface-canvas)] text-[var(--text-main)] focus:outline-none focus:border-[var(--primary-main)] text-sm h-12 uppercase font-mono rounded"
                />
              </div>

              {/* Expirations */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold uppercase tracking-wider block text-[var(--text-main)]">{t("pantry.expirationDateOptional")}</label>
                <input
                  type="date"
                  value={expirationDate}
                  onChange={(e) => setExpirationDate(e.target.value)}
                  className="w-full py-3 px-3 border border-[var(--border-subtle)] bg-[var(--surface-canvas)] text-[var(--text-main)] focus:outline-none focus:border-[var(--primary-main)] text-sm h-12 font-mono rounded"
                />
              </div>
            </div>

            {/* Notes */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold uppercase tracking-wider block text-[var(--text-main)]">{t("pantry.transactionNotesOptional")}</label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder={t("pantry.notesPlaceholder")}
                rows={2}
                className="w-full py-3 px-3 border border-[var(--border-subtle)] bg-[var(--surface-canvas)] text-[var(--text-main)] focus:outline-none focus:border-[var(--primary-main)] text-sm font-sans rounded"
              />
            </div>
            
            {createTransactionMut.isError && (
              <div className="border border-red-800/40 bg-red-950/20 text-red-400 p-4 text-xs font-semibold flex items-start gap-2 rounded">
                <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                <div>
                  <div className="uppercase font-bold">{t("pantry.transactionRejected")}</div>
                  <div className="font-normal mt-0.5">{(createTransactionMut.error as any)?.message}</div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* MODAL ACTION BOTTOM ROW */}
        <DialogFooter className="flex-col sm:flex-row gap-2 mt-4 pt-4 border-t border-[var(--border-subtle)]">
          <Button 
            onClick={onClose} 
            variant="outline" 
            className="w-full sm:w-auto text-xs uppercase h-10 px-4"
            disabled={createTransactionMut.isPending}
          >
            {t("pantry.cancel")}
          </Button>
          {selectedProduct && (
            <Button
              onClick={handleSubmit}
              className="w-full sm:w-auto text-xs uppercase bg-[var(--primary-main)] text-black hover:bg-[var(--primary-hover)] font-bold h-10 px-4 transition-all"
              disabled={createTransactionMut.isPending || !selectedLocationId || !unit.trim()}
            >
              {createTransactionMut.isPending ? (
                <>
                  <Loader2 className="h-3 w-3 animate-spin mr-2" />
                  {t("pantry.loggingLedger")}
                </>
              ) : (
                <>
                  <Check className="h-3.5 w-3.5 mr-1.5" />
                  {t("pantry.submitTransaction")}
                </>
              )}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
