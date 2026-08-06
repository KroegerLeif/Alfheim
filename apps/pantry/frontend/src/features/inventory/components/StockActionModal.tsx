"use client";

import * as React from "react";
import { useTranslation } from "@loeger-os/shared";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { ProductSearchStep } from "./ProductSearchStep";
import { QuickProductForm } from "./QuickProductForm";
import { TransactionForm } from "./TransactionForm";
import { useSearchProducts } from "@/features/products/services/productService";
import { pantryClient } from "@/core/api";
import { ProductRead } from "@/features/products/types";

interface StockActionModalProps {
  isOpen: boolean;
  onClose: () => void;
  mode: "in" | "out";
  preselectedProduct?: ProductRead | null;
}

/**
 * StockActionModal
 * Orchestrates the stock transaction flow:
 * 1. Product selection via search or barcode scan.
 * 2. Optional inline quick product/category creation.
 * 3. Transaction entry (quantity, unit, location, batch, expiry).
 */
export function StockActionModal({ isOpen, onClose, mode, preselectedProduct = null }: StockActionModalProps) {
  const { t } = useTranslation();
  const [productQuery, setProductQuery] = React.useState("");
  const [selectedProduct, setSelectedProduct] = React.useState<ProductRead | null>(null);
  const [barcodeInput, setBarcodeInput] = React.useState("");
  const [scanError, setScanError] = React.useState("");
  const [isCreatingProduct, setIsCreatingProduct] = React.useState(false);

  const { data: searchResults = [], isLoading: isSearchingProducts } = useSearchProducts(productQuery);

  // Reset state when modal opens or closes
  React.useEffect(() => {
    if (isOpen) {
      if (preselectedProduct) setSelectedProduct(preselectedProduct);
    } else {
      setProductQuery("");
      setSelectedProduct(null);
      setBarcodeInput("");
      setScanError("");
      setIsCreatingProduct(false);
    }
  }, [isOpen, preselectedProduct]);

  const handleBarcodeSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!barcodeInput.trim()) return;
    setScanError("");
    try {
      const data = await pantryClient.get(`api/v1/products/barcode/${barcodeInput}`).json<ProductRead>();
      setSelectedProduct(data);
      setBarcodeInput("");
    } catch {
      setScanError(t("pantry.noMatchesFound"));
    }
  };

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

        {!selectedProduct ? (
          <div className="space-y-6 my-4">
            {isCreatingProduct ? (
              <QuickProductForm
                initialName={productQuery.trim()}
                initialBarcode={barcodeInput.trim()}
                onCreated={(product) => { setSelectedProduct(product); setIsCreatingProduct(false); setProductQuery(""); setBarcodeInput(""); }}
                onCancel={() => setIsCreatingProduct(false)}
              />
            ) : (
              <ProductSearchStep
                productQuery={productQuery}
                onQueryChange={setProductQuery}
                searchResults={searchResults}
                isSearchingProducts={isSearchingProducts}
                barcodeInput={barcodeInput}
                onBarcodeChange={setBarcodeInput}
                scanError={scanError}
                onBarcodeSearch={handleBarcodeSearch}
                onProductSelect={(p) => { setSelectedProduct(p); setProductQuery(""); setIsCreatingProduct(false); }}
                onOpenInlineProductCreation={() => setIsCreatingProduct(true)}
              />
            )}
          </div>
        ) : (
          <TransactionForm
            mode={mode}
            selectedProduct={selectedProduct}
            onSuccess={onClose}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
