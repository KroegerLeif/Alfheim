"use client";

import * as React from "react";
import {
  Button,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  useTranslation,
} from "@alfheim/shared";
import { Loader2 } from "lucide-react";
import { describeApiError } from "@/core/apiError";
import { ErrorBanner } from "@/components/shared/ErrorBanner";
import { useCategories } from "@/features/categories/services/categoryService";
import { ProductRead } from "../types";
import { useUpdateProduct } from "../services/productService";

interface ProductEditDialogProps {
  product: ProductRead;
  onClose: () => void;
}

const FIELD =
  "w-full p-2.5 border border-[var(--border-subtle)] bg-[var(--surface-canvas)] text-[var(--text-main)] text-sm rounded font-mono";

/**
 * ProductEditDialog
 * Edits the name, brand, category and minimum stock of a custom product. The barcode and base unit
 * are not editable here: a barcode promotes the product to a read-only global template, and the
 * base unit defines how existing stock is counted.
 */
export function ProductEditDialog({ product, onClose }: ProductEditDialogProps) {
  const { t } = useTranslation();
  const { data: categories = [] } = useCategories();
  const updateProductMut = useUpdateProduct();
  const [name, setName] = React.useState(product.name);
  const [brand, setBrand] = React.useState(product.brand ?? "");
  const [categoryId, setCategoryId] = React.useState(product.category_id ?? "");
  const [minimumStock, setMinimumStock] = React.useState(product.minimum_stock);
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) { setErrorMessage(t("pantry.nameRequired")); return; }
    setErrorMessage(null);
    updateProductMut.mutate(
      {
        id: product.id,
        payload: {
          name: name.trim(),
          brand: brand.trim() || null,
          category_id: categoryId || null,
          minimum_stock: minimumStock,
        },
      },
      {
        onSuccess: onClose,
        onError: async (error) => setErrorMessage(await describeApiError(error, t, "pantry.errors.updateProductFailed")),
      }
    );
  };

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto border border-[var(--border-subtle)] bg-[var(--surface-card)] text-[var(--text-main)]">
        <DialogHeader>
          <DialogTitle>{t("pantry.edit.productTitle")}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          {errorMessage && <ErrorBanner message={errorMessage} />}
          <div className="space-y-1">
            <label htmlFor="edit-product-name" className="text-xs font-bold uppercase block">{t("pantry.productName")} *</label>
            <input id="edit-product-name" type="text" value={name} onChange={(e) => setName(e.target.value)} required maxLength={255} className={FIELD} />
          </div>
          <div className="space-y-1">
            <label htmlFor="edit-product-brand" className="text-xs font-bold uppercase block">{t("pantry.brand")}</label>
            <input id="edit-product-brand" type="text" value={brand} onChange={(e) => setBrand(e.target.value)} maxLength={255} className={FIELD} />
          </div>
          <div className="space-y-1">
            <label htmlFor="edit-product-category" className="text-xs font-bold uppercase block">{t("pantry.category")}</label>
            <select id="edit-product-category" value={categoryId} onChange={(e) => setCategoryId(e.target.value)} className={`${FIELD} uppercase`}>
              <option value="">{t("pantry.noCategory")}</option>
              {categories.map((cat) => <option key={cat.id} value={cat.id}>{cat.name.toUpperCase()}</option>)}
            </select>
          </div>
          <div className="space-y-1">
            <label htmlFor="edit-product-min" className="text-xs font-bold uppercase block">{t("pantry.minStockLabel")}</label>
            <input id="edit-product-min" type="number" step="any" min="0" value={minimumStock}
              onChange={(e) => setMinimumStock(Math.max(0, parseFloat(e.target.value) || 0))} className={FIELD} />
          </div>
          <DialogFooter className="gap-2">
            <Button type="button" variant="outline" size="sm" onClick={onClose} disabled={updateProductMut.isPending}>
              {t("common.cancel")}
            </Button>
            <Button type="submit" size="sm" disabled={updateProductMut.isPending}>
              {updateProductMut.isPending ? <><Loader2 className="h-3 w-3 animate-spin" />{t("common.saving")}</> : t("common.save")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
