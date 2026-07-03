"use client";

import * as React from "react";
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
import { useSearchProducts } from "@/features/products/services/productService";
import { useCreateTransaction } from "@/features/inventory/services/inventoryService";
import { ProductRead } from "@/features/inventory/types";
import { Search, Barcode, Plus, Minus, Check, Loader2, AlertCircle } from "lucide-react";

interface StockActionModalProps {
  isOpen: boolean;
  onClose: () => void;
  mode: "in" | "out";
}

/**
 * StockActionModal Component
 * Facilitates recording physical stock transactions (IN / OUT movements).
 * Provides a simulated barcode reader and a manual registry search.
 * Incorporates a touch-stepper for fast tablet-based quantity logging.
 */
export function StockActionModal({ isOpen, onClose, mode }: StockActionModalProps) {
  const [productQuery, setProductQuery] = React.useState("");
  const [selectedProduct, setSelectedProduct] = React.useState<ProductRead | null>(null);
  const [selectedLocationId, setSelectedLocationId] = React.useState<string>("");
  
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
  const { data: searchResults = [], isLoading: isSearchingProducts } = useSearchProducts(productQuery);
  const createTransactionMut = useCreateTransaction();

  // Reset local state variables when modal status changes
  React.useEffect(() => {
    if (!isOpen) {
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
    }
  }, [isOpen]);

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

  // Simulate scanning of physical barcodes
  const handleBarcodeSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!barcodeInput.trim()) return;
    
    setScanError("");
    try {
      const response = await fetch(`http://localhost:8000/api/v1/products/barcode/${barcodeInput}`);
      if (!response.ok) {
        throw new Error("Product barcode not found in registry.");
      }
      const data: ProductRead = await response.json();
      setSelectedProduct(data);
      setBarcodeInput("");
    } catch (err: any) {
      setScanError(err.message || "Failed to locate barcode.");
    }
  };

  const handleProductSelect = (product: ProductRead) => {
    setSelectedProduct(product);
    setProductQuery("");
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
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto border border-border bg-background p-6 font-mono">
        <DialogHeader>
          <DialogTitle className="text-3xl font-heading font-black tracking-wide">
            TRANSACTION: {mode === "in" ? "STOCK IN" : "STOCK OUT"}
          </DialogTitle>
          <DialogDescription className="uppercase tracking-widest text-[10px] text-muted-foreground mt-1">
            Physical stock ledger update utility
          </DialogDescription>
        </DialogHeader>

        {/* SELECT PRODUCT PANELS */}
        {!selectedProduct ? (
          <div className="space-y-6 my-4">
            {/* Simulated Barcode scanning panel */}
            <form onSubmit={handleBarcodeSearch} className="border border-border p-4 bg-neutral-50 space-y-3">
              <label className="text-xs font-bold uppercase tracking-wider block">
                Simulate Barcode Scanner (UPC/EAN)
              </label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Barcode className="absolute left-3 top-3.5 h-4 w-4 text-neutral-400" />
                  <input
                    type="text"
                    value={barcodeInput}
                    onChange={(e) => setBarcodeInput(e.target.value)}
                    placeholder="Enter EAN (e.g. 4008400200123)"
                    className="w-full pl-9 pr-4 py-3 border border-border bg-background focus:outline-none focus:ring-1 focus:ring-ring text-sm"
                  />
                </div>
                <Button type="submit" variant="outline" className="h-12 text-xs uppercase px-4 cursor-pointer">
                  Scan EAN
                </Button>
              </div>
              {scanError && (
                <div className="text-xs text-destructive font-semibold flex items-center gap-1.5 mt-1">
                  <AlertCircle className="h-3 w-3" />
                  <span>{scanError}</span>
                </div>
              )}
            </form>

            {/* Product text filter query */}
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-wider block">
                Search Product Blueprint Registry
              </label>
              <div className="relative">
                <Search className="absolute left-3 top-4.5 h-4 w-4 text-neutral-400" />
                <input
                  type="text"
                  value={productQuery}
                  onChange={(e) => setProductQuery(e.target.value)}
                  placeholder="Type product name (e.g. milk, pasta)..."
                  className="w-full pl-9 pr-4 py-4 border border-border bg-background focus:outline-none focus:ring-1 focus:ring-ring text-sm"
                />
              </div>

              {/* Reactive search list */}
              {productQuery.trim().length > 0 && (
                <div className="border border-border max-h-60 overflow-y-auto divide-y divide-neutral-200 bg-background mt-1">
                  {isSearchingProducts ? (
                    <div className="p-4 text-center text-xs text-muted-foreground">Searching registry...</div>
                  ) : searchResults.length === 0 ? (
                    <div className="p-4 text-center text-xs text-muted-foreground">No matches found.</div>
                  ) : (
                    searchResults.map((product) => (
                      <button
                        key={product.id}
                        type="button"
                        onClick={() => handleProductSelect(product)}
                        className="w-full text-left p-4 hover:bg-neutral-50 flex items-center justify-between text-sm transition-all border-b border-border last:border-b-0 cursor-pointer"
                      >
                        <div>
                          <div className="font-bold uppercase tracking-tight">{product.name}</div>
                          {product.brand && <div className="text-[10px] text-muted-foreground uppercase mt-0.5">{product.brand}</div>}
                        </div>
                        {product.barcode && (
                          <div className="font-mono text-xs text-muted-foreground bg-neutral-100 px-2 py-0.5 border border-border">
                            {product.barcode}
                          </div>
                        )}
                      </button>
                    ))
                  )}
                </div>
              )}
            </div>
          </div>
        ) : (
          /* TRANSACTION DATA DETAILS FORM */
          <div className="space-y-5 my-4">
            {/* Selected product header panel */}
            <div className="border border-border p-4 bg-neutral-900 text-white flex justify-between items-center">
              <div>
                <span className="text-[10px] uppercase font-bold tracking-widest text-neutral-400 block">Selected Item</span>
                <h3 className="text-xl font-bold uppercase tracking-tight mt-1">{selectedProduct.name}</h3>
                {selectedProduct.brand && (
                  <span className="text-xs uppercase text-neutral-400 mt-0.5 block">{selectedProduct.brand}</span>
                )}
              </div>
              <Button 
                onClick={() => setSelectedProduct(null)} 
                variant="outline" 
                className="text-[10px] h-8 px-3 border-neutral-700 bg-neutral-800 text-neutral-300 hover:bg-neutral-700 hover:text-white"
              >
                Change Item
              </Button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Storage Location selectors */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold uppercase tracking-wider block">Target Location</label>
                <select
                  value={selectedLocationId}
                  onChange={(e) => setSelectedLocationId(e.target.value)}
                  className="w-full py-3 px-3 border border-border bg-background focus:outline-none focus:ring-1 focus:ring-ring text-sm h-12 uppercase"
                >
                  {isLoadingLocs ? (
                    <option>Loading locations...</option>
                  ) : (
                    locations.map((loc) => (
                      <option key={loc.id} value={loc.id}>
                        {loc.name.toUpperCase()} {loc.is_system ? "(SYSTEM)" : ""}
                      </option>
                    ))
                  )}
                </select>
              </div>

              {/* Units Input selector */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold uppercase tracking-wider block">Unit of Measurement</label>
                <input
                  type="text"
                  value={unit}
                  onChange={(e) => setUnit(e.target.value)}
                  placeholder="e.g. piece, kg, g, l"
                  className="w-full py-3 px-3 border border-border bg-background focus:outline-none focus:ring-1 focus:ring-ring text-sm h-12 uppercase font-mono"
                />
              </div>
            </div>

            {/* Stepper Quantity selection box */}
            <div className="border border-border p-4 bg-neutral-50 space-y-4">
              <label className="text-xs font-bold uppercase tracking-wider block text-center">Transaction Quantity</label>
              
              <div className="flex items-center justify-center gap-4">
                <Button
                  type="button"
                  onClick={() => adjustQuantity(-1)}
                  variant="outline"
                  className="h-14 w-14 text-2xl font-black border border-border flex items-center justify-center p-0"
                >
                  <Minus className="h-5 w-5" />
                </Button>
                <input
                  type="number"
                  step="any"
                  value={quantity}
                  onChange={(e) => setQuantity(Math.max(0.1, parseFloat(parseFloat(e.target.value).toFixed(2)) || 1))}
                  className="w-32 h-14 border border-border bg-background text-center text-2xl font-black focus:outline-none focus:ring-1 focus:ring-ring font-mono"
                />
                <Button
                  type="button"
                  onClick={() => adjustQuantity(1)}
                  variant="outline"
                  className="h-14 w-14 text-2xl font-black border border-border flex items-center justify-center p-0"
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
                    className="flex-1 py-4 text-xs font-black border border-border h-10"
                  >
                    {val}
                  </Button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Batch Codes */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold uppercase tracking-wider block">Batch Code (Optional)</label>
                <input
                  type="text"
                  value={batchCode}
                  onChange={(e) => setBatchCode(e.target.value)}
                  placeholder="e.g. BATCH-A4"
                  className="w-full py-3 px-3 border border-border bg-background focus:outline-none focus:ring-1 focus:ring-ring text-sm h-12 uppercase font-mono"
                />
              </div>

              {/* Expirations */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold uppercase tracking-wider block">Expiration Date (Optional)</label>
                <input
                  type="date"
                  value={expirationDate}
                  onChange={(e) => setExpirationDate(e.target.value)}
                  className="w-full py-3 px-3 border border-border bg-background focus:outline-none focus:ring-1 focus:ring-ring text-sm h-12 font-mono"
                />
              </div>
            </div>

            {/* Notes */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold uppercase tracking-wider block">Transaction Notes (Optional)</label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Log physical inspection notes or adjustments here..."
                rows={2}
                className="w-full py-3 px-3 border border-border bg-background focus:outline-none focus:ring-1 focus:ring-ring text-sm font-sans"
              />
            </div>
            
            {createTransactionMut.isError && (
              <div className="border border-destructive bg-red-50 text-destructive p-4 text-xs font-semibold flex items-start gap-2">
                <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                <div>
                  <div className="uppercase font-bold">Transaction rejected</div>
                  <div className="font-normal mt-0.5">{(createTransactionMut.error as any)?.message}</div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* MODAL ACTION BOTTOM ROW */}
        <DialogFooter className="flex-col sm:flex-row gap-2 mt-4 pt-4 border-t border-border">
          <Button 
            onClick={onClose} 
            variant="outline" 
            className="w-full sm:w-auto text-xs uppercase h-10 px-4"
            disabled={createTransactionMut.isPending}
          >
            Cancel
          </Button>
          {selectedProduct && (
            <Button
              onClick={handleSubmit}
              className="w-full sm:w-auto text-xs uppercase bg-black text-white hover:bg-neutral-800 h-10 px-4"
              disabled={createTransactionMut.isPending || !selectedLocationId || !unit.trim()}
            >
              {createTransactionMut.isPending ? (
                <>
                  <Loader2 className="h-3 w-3 animate-spin mr-2" />
                  Logging Ledger...
                </>
              ) : (
                <>
                  <Check className="h-3.5 w-3.5 mr-1.5" />
                  Submit Transaction
                </>
              )}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
