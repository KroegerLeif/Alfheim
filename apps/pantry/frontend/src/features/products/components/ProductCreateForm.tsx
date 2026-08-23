"use client";

import * as React from "react";
import { useTranslation } from "@alfheim/shared";
import { useCreateProduct } from "../services/productService";
import { useCategories } from "@/features/categories/services/categoryService";
import { Button } from "@alfheim/shared";
import { Plus, Loader2, Check, AlertCircle, Barcode } from "lucide-react";

/**
 * ProductCreateForm
 * Right-hand panel form for creating a new product blueprint (Stammdaten).
 */
export function ProductCreateForm() {
  const { t } = useTranslation();
  const [name, setName] = React.useState("");
  const [brand, setBrand] = React.useState("");
  const [barcode, setBarcode] = React.useState("");
  const [baseUnit, setBaseUnit] = React.useState("piece");
  const [minimumStock, setMinimumStock] = React.useState(0);
  const [categoryId, setCategoryId] = React.useState("");
  const [successMessage, setSuccessMessage] = React.useState<string | null>(null);
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);

  const { data: categories = [] } = useCategories();
  const createProductMut = useCreateProduct();

  const clearMessages = () => { setSuccessMessage(null); setErrorMessage(null); };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    clearMessages();
    if (!name.trim()) { setErrorMessage(t("pantry.nameRequired")); return; }
    createProductMut.mutate(
      { name: name.trim(), brand: brand.trim() || null, barcode: barcode.trim() || null,
        base_unit: baseUnit, minimum_stock: Number(minimumStock) || 0, category_id: categoryId || null, nutrition: null },
      {
        onSuccess: () => {
          setSuccessMessage(t("pantry.productSuccess"));
          setName(""); setBrand(""); setBarcode(""); setBaseUnit("piece"); setMinimumStock(0); setCategoryId("");
          setTimeout(() => setSuccessMessage(null), 4000);
        },
        onError: (error: any) => setErrorMessage(error.message || t("pantry.createProductFailed")),
      }
    );
  };

  return (
    <div className="lg:col-span-1 p-8 bg-[var(--surface-elevated)] flex flex-col">
      <div className="border border-[var(--border-subtle)] bg-[var(--surface-card)] p-6 space-y-6 rounded-lg shadow-sm">
        <h2 className="text-2xl font-heading font-black tracking-wide border-b border-[var(--border-subtle)] pb-3 text-[var(--text-main)]">
          {t("pantry.createProductTitle")}
        </h2>

        {errorMessage && (
          <div className="border border-red-800/40 bg-red-950/20 text-red-400 p-3 text-xs flex items-start gap-2 uppercase font-bold leading-normal rounded">
            <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" /><span>{errorMessage}</span>
          </div>
        )}
        {successMessage && (
          <div className="border border-emerald-800/40 bg-emerald-950/20 text-emerald-400 p-3 text-xs flex items-start gap-2 uppercase font-bold leading-normal rounded">
            <Check className="h-4 w-4 shrink-0 mt-0.5" /><span>{successMessage}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {[
            { id: "product-name", label: `${t("pantry.productName")} *`, value: name, setter: setName, placeholder: t("pantry.namePlaceholder"), required: true },
            { id: "product-brand", label: t("pantry.brand"), value: brand, setter: setBrand, placeholder: t("pantry.brandPlaceholder") },
          ].map(({ id, label, value, setter, placeholder, required }) => (
            <div key={id} className="space-y-1.5">
              <label htmlFor={id} className="text-xs font-bold uppercase tracking-wider block text-[var(--text-main)]">{label}</label>
              <input id={id} type="text" value={value} onChange={(e) => { setter(e.target.value); clearMessages(); }}
                placeholder={placeholder} required={required}
                className="w-full py-3 px-3 border border-[var(--border-subtle)] bg-[var(--surface-canvas)] text-[var(--text-main)] focus:outline-none focus:border-[var(--primary-main)] text-sm h-12 uppercase font-mono rounded" />
            </div>
          ))}

          <div className="space-y-1.5">
            <label htmlFor="product-barcode" className="text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 text-[var(--text-main)]">
              <Barcode className="h-3.5 w-3.5 text-[var(--text-muted)]" />{t("pantry.barcode")}
            </label>
            <input id="product-barcode" type="text" value={barcode} onChange={(e) => { setBarcode(e.target.value); clearMessages(); }}
              placeholder={t("pantry.barcodePlaceholder")}
              className="w-full py-3 px-3 border border-[var(--border-subtle)] bg-[var(--surface-canvas)] text-[var(--text-main)] focus:outline-none focus:border-[var(--primary-main)] text-sm h-12 uppercase font-mono rounded" />
          </div>

          <div className="space-y-1.5">
            <label htmlFor="product-category" className="text-xs font-bold uppercase tracking-wider block text-[var(--text-main)]">{t("pantry.category")}</label>
            <select id="product-category" value={categoryId} onChange={(e) => { setCategoryId(e.target.value); clearMessages(); }}
              className="w-full py-3 px-3 border border-[var(--border-subtle)] bg-[var(--surface-canvas)] text-[var(--text-main)] focus:outline-none focus:border-[var(--primary-main)] text-sm h-12 uppercase rounded">
              <option value="">{t("pantry.filterCategory")}</option>
              {categories.map((cat) => <option key={cat.id} value={cat.id}>{cat.name.toUpperCase()}</option>)}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label htmlFor="product-base-unit" className="text-xs font-bold uppercase tracking-wider block text-[var(--text-main)]">{t("pantry.baseUnit")}</label>
              <select id="product-base-unit" value={baseUnit} onChange={(e) => { setBaseUnit(e.target.value); clearMessages(); }}
                className="w-full py-3 px-3 border border-[var(--border-subtle)] bg-[var(--surface-canvas)] text-[var(--text-main)] focus:outline-none focus:border-[var(--primary-main)] text-sm h-12 uppercase rounded">
                <option value="piece">{t("pantry.unitPiece")}</option>
                <option value="g">{t("pantry.unitGrams")}</option>
                <option value="ml">{t("pantry.unitMilliliters")}</option>
                <option value="m">{t("pantry.unitMeters")}</option>
              </select>
            </div>
            <div className="space-y-1.5">
              <label htmlFor="product-minimum-stock" className="text-xs font-bold uppercase tracking-wider block text-nowrap truncate text-[var(--text-main)]">{t("pantry.minStockLabel")}</label>
              <input id="product-minimum-stock" type="number" step="any" min="0" value={minimumStock}
                onChange={(e) => { setMinimumStock(Math.max(0, parseFloat(e.target.value) || 0)); clearMessages(); }}
                className="w-full py-3 px-3 border border-[var(--border-subtle)] bg-[var(--surface-canvas)] text-[var(--text-main)] focus:outline-none focus:border-[var(--primary-main)] text-sm h-12 uppercase font-mono rounded" />
            </div>
          </div>

          <div className="pt-4">
            <Button type="submit" disabled={createProductMut.isPending}
              className="w-full py-6 text-xs font-black tracking-widest border-2 border-[var(--border-accent)] bg-[var(--primary-main)] text-black hover:bg-[var(--primary-hover)] cursor-pointer select-none transition-all flex items-center justify-center gap-2 rounded-lg">
              {createProductMut.isPending ? (
                <><Loader2 className="h-4 w-4 animate-spin" />{t("pantry.creatingProduct")}</>
              ) : (
                <><Plus className="h-4 w-4" />{t("pantry.submitProduct")}</>
              )}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
