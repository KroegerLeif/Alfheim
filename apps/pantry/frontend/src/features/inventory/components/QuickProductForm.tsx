"use client";

import * as React from "react";
import { useTranslation } from "@loeger-os/shared";
import { Button } from "@/components/ui/button";
import { Loader2, PackagePlus } from "lucide-react";
import { useCreateProduct } from "@/features/products/services/productService";
import { useCategories } from "@/features/categories/services/categoryService";
import { QuickCategoryForm } from "./QuickCategoryForm";
import { ProductRead } from "@/features/products/types";

interface QuickProductFormProps {
  initialName?: string;
  initialBarcode?: string;
  onCreated: (product: ProductRead) => void;
  onCancel: () => void;
}

/**
 * QuickProductForm
 * Inline form to create a new product blueprint from within the StockActionModal.
 */
export function QuickProductForm({
  initialName = "", initialBarcode = "", onCreated, onCancel,
}: QuickProductFormProps) {
  const { t } = useTranslation();
  const [name, setName] = React.useState(initialName);
  const [brand, setBrand] = React.useState("");
  const [barcode, setBarcode] = React.useState(initialBarcode);
  const [baseUnit, setBaseUnit] = React.useState("piece");
  const [minStock, setMinStock] = React.useState(0);
  const [categoryId, setCategoryId] = React.useState("");
  const [isCreatingCategory, setIsCreatingCategory] = React.useState(false);

  const { data: categories = [] } = useCategories();
  const createProductMut = useCreateProduct();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    createProductMut.mutate(
      { name: name.trim(), brand: brand.trim() || null, barcode: barcode.trim() || null,
        base_unit: baseUnit, minimum_stock: Number(minStock) || 0, category_id: categoryId || null, nutrition: null },
      { onSuccess: onCreated }
    );
  };

  return (
    <div className="border border-[var(--border-accent)] p-5 bg-[var(--surface-elevated)] space-y-4 rounded-lg">
      <div className="flex justify-between items-center border-b border-[var(--border-subtle)] pb-3">
        <h3 className="font-heading font-bold text-lg uppercase flex items-center gap-2 text-[var(--primary-main)]">
          <PackagePlus className="h-5 w-5" />{t("pantry.createProductTitle")}
        </h3>
        <Button type="button" variant="outline" size="sm" onClick={onCancel} className="text-xs uppercase">
          {t("pantry.cancel")}
        </Button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-1">
            <label className="text-xs font-bold uppercase block">{t("pantry.productName")} *</label>
            <input type="text" value={name} onChange={(e) => setName(e.target.value)} required
              className="w-full p-2.5 border border-[var(--border-subtle)] bg-[var(--surface-canvas)] text-[var(--text-main)] text-sm rounded font-mono" />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-bold uppercase block">{t("pantry.brand")}</label>
            <input type="text" value={brand} onChange={(e) => setBrand(e.target.value)}
              className="w-full p-2.5 border border-[var(--border-subtle)] bg-[var(--surface-canvas)] text-[var(--text-main)] text-sm rounded font-mono" />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-1">
            <label className="text-xs font-bold uppercase block">{t("pantry.barcode")}</label>
            <input type="text" value={barcode} onChange={(e) => setBarcode(e.target.value)}
              className="w-full p-2.5 border border-[var(--border-subtle)] bg-[var(--surface-canvas)] text-[var(--text-main)] text-sm rounded font-mono" />
          </div>
          <div className="space-y-1">
            <div className="flex justify-between items-center">
              <label className="text-xs font-bold uppercase block">{t("pantry.category")}</label>
              <button type="button" onClick={() => setIsCreatingCategory(!isCreatingCategory)}
                className="text-[10px] text-[var(--primary-main)] hover:underline uppercase font-bold">
                + {t("pantry.createCategoryTitle")}
              </button>
            </div>
            {isCreatingCategory ? (
              <QuickCategoryForm
                onCreated={(id) => { setCategoryId(id); setIsCreatingCategory(false); }}
                onCancel={() => setIsCreatingCategory(false)}
              />
            ) : (
              <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)}
                className="w-full p-2.5 border border-[var(--border-subtle)] bg-[var(--surface-canvas)] text-[var(--text-main)] text-sm rounded uppercase font-mono">
                <option value="">{t("pantry.filterCategory")}</option>
                {categories.map((c) => <option key={c.id} value={c.id}>{c.name.toUpperCase()}</option>)}
              </select>
            )}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1">
            <label className="text-xs font-bold uppercase block">{t("pantry.baseUnit")}</label>
            <select value={baseUnit} onChange={(e) => setBaseUnit(e.target.value)}
              className="w-full p-2.5 border border-[var(--border-subtle)] bg-[var(--surface-canvas)] text-[var(--text-main)] text-sm rounded uppercase font-mono">
              <option value="piece">{t("pantry.unitPiece")}</option>
              <option value="g">{t("pantry.unitGrams")}</option>
              <option value="ml">{t("pantry.unitMilliliters")}</option>
              <option value="m">{t("pantry.unitMeters")}</option>
            </select>
          </div>
          <div className="space-y-1">
            <label className="text-xs font-bold uppercase block">{t("pantry.minStockLabel")}</label>
            <input type="number" step="any" min="0" value={minStock}
              onChange={(e) => setMinStock(Math.max(0, parseFloat(e.target.value) || 0))}
              className="w-full p-2.5 border border-[var(--border-subtle)] bg-[var(--surface-canvas)] text-[var(--text-main)] text-sm rounded font-mono" />
          </div>
        </div>

        <Button type="submit" disabled={createProductMut.isPending || !name.trim()}
          className="w-full py-3 text-xs font-black tracking-widest border-2 border-[var(--border-accent)] bg-[var(--primary-main)] text-black hover:bg-[var(--primary-hover)] flex items-center justify-center gap-2 rounded-lg">
          {createProductMut.isPending ? (
            <><Loader2 className="h-4 w-4 animate-spin" />{t("pantry.creatingProduct")}</>
          ) : t("pantry.submitProduct")}
        </Button>
      </form>
    </div>
  );
}
