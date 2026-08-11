"use client";

import * as React from "react";
import { useTranslation } from "@alfheim/shared";
import { Button } from "@/components/ui/button";
import { Search, Barcode, PackagePlus, Loader2 } from "lucide-react";
import { ProductRead } from "@/features/products/types";

interface ProductSearchStepProps {
  productQuery: string;
  onQueryChange: (q: string) => void;
  searchResults: ProductRead[];
  isSearchingProducts: boolean;
  barcodeInput: string;
  onBarcodeChange: (v: string) => void;
  scanError: string;
  onBarcodeSearch: (e: React.FormEvent) => void;
  onProductSelect: (product: ProductRead) => void;
  onOpenInlineProductCreation: () => void;
}

/**
 * ProductSearchStep
 * Handles product selection via text search or barcode scan within the StockActionModal.
 */
export function ProductSearchStep({
  productQuery, onQueryChange,
  searchResults, isSearchingProducts,
  barcodeInput, onBarcodeChange,
  scanError, onBarcodeSearch,
  onProductSelect, onOpenInlineProductCreation,
}: ProductSearchStepProps) {
  const { t } = useTranslation();

  return (
    <div className="space-y-4">
      {/* Manual text search */}
      <div className="space-y-1">
        <label className="text-xs font-bold uppercase block">{t("pantry.searchProduct")}</label>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--text-muted)]" />
          <input
            type="text"
            value={productQuery}
            onChange={(e) => onQueryChange(e.target.value)}
            placeholder={t("pantry.searchPlaceholder")}
            className="w-full pl-10 pr-4 py-2.5 border border-[var(--border-subtle)] bg-[var(--surface-canvas)] text-[var(--text-main)] text-sm rounded font-mono"
          />
        </div>
        {productQuery.trim().length > 0 && (
          <div className="border border-[var(--border-subtle)] bg-[var(--surface-card)] mt-1 max-h-40 overflow-y-auto rounded">
            {isSearchingProducts ? (
              <div className="flex items-center gap-2 p-3 text-xs text-[var(--text-muted)]">
                <Loader2 className="h-3 w-3 animate-spin" />{t("pantry.syncingBlueprints")}
              </div>
            ) : searchResults.length === 0 ? (
              <div className="p-3 text-xs text-[var(--text-muted)] uppercase">{t("pantry.noProducts")}</div>
            ) : (
              searchResults.map((product) => (
                <button key={product.id} type="button" onClick={() => onProductSelect(product)}
                  className="w-full text-left px-3 py-2 hover:bg-[var(--surface-elevated)] text-xs border-b border-[var(--border-subtle)] last:border-b-0">
                  <div className="font-bold uppercase">{product.name}</div>
                  {product.brand && <div className="text-[var(--text-muted)]">{product.brand}</div>}
                </button>
              ))
            )}
          </div>
        )}
      </div>

      {/* Barcode scan */}
      <form onSubmit={onBarcodeSearch} className="space-y-1">
        <label className="text-xs font-bold uppercase flex items-center gap-1.5">
          <Barcode className="h-3.5 w-3.5" /> {t("pantry.barcode")}
        </label>
        <div className="flex gap-2">
          <input type="text" value={barcodeInput} onChange={(e) => onBarcodeChange(e.target.value)}
            placeholder={t("pantry.barcodePlaceholder")}
            className="flex-1 p-2.5 border border-[var(--border-subtle)] bg-[var(--surface-canvas)] text-[var(--text-main)] text-sm rounded font-mono" />
          <Button type="submit" variant="outline" size="sm" className="text-xs uppercase shrink-0">
            {t("pantry.scan")}
          </Button>
        </div>
        {scanError && <p className="text-xs text-red-400 font-bold">{scanError}</p>}
      </form>

      {/* Quick product creation CTA */}
      {(productQuery.trim().length > 0 || barcodeInput.trim().length > 0) && (
        <Button type="button" variant="outline" size="sm" onClick={onOpenInlineProductCreation}
          className="w-full text-xs uppercase tracking-wider border-dashed gap-1.5">
          <PackagePlus className="h-3.5 w-3.5" />
          {t("pantry.createProductTitle")}
        </Button>
      )}
    </div>
  );
}
