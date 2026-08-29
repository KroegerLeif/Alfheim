"use client";

import { AlfiAvatar, useTranslation } from "@alfheim/shared";
import { Loader2 } from "lucide-react";
import { ProductRead } from "@/features/products/types";
import { CategoryRead } from "@/features/categories/types";
import { usePantryChat } from "@/core/chatContext";

interface ProductListProps {
  products: ProductRead[];
  categories: CategoryRead[];
  isLoading: boolean;
}

/**
 * ProductList
 * Renders the scrollable product blueprint feed with metadata spec rows and contextual ALFI triggers.
 */
export function ProductList({ products, categories, isLoading }: ProductListProps) {
  const { t } = useTranslation();
  const { openChat } = usePantryChat();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12 gap-3">
        <Loader2 className="h-5 w-5 animate-spin text-[var(--primary-main)]" />
        <span className="text-xs uppercase font-bold tracking-widest text-[var(--text-muted)]">{t("pantry.syncingBlueprints")}</span>
      </div>
    );
  }

  if (products.length === 0) {
    return (
      <div className="border border-dashed border-[var(--border-subtle)] p-8 text-center text-xs text-[var(--text-muted)] uppercase tracking-widest rounded-lg">
        {t("pantry.noProducts")}
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto space-y-4 max-h-[calc(100vh-270px)] pr-2">
      {products.map((product) => {
        const category = categories.find((cat) => cat.id === product.category_id);
        return (
          <div
            key={product.id}
            className="border border-[var(--border-subtle)] p-4 bg-[var(--surface-card)] hover:border-[var(--border-accent)] transition-all flex flex-col md:flex-row md:items-center justify-between gap-4 rounded-lg shadow-sm"
          >
            <div className="space-y-1.5 flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-heading text-lg font-bold uppercase truncate tracking-wide text-[var(--text-main)]">{product.name}</span>
                <span className={`text-[9px] font-bold px-1.5 py-0.5 uppercase rounded ${product.is_global ? "bg-[var(--primary-main)] text-black" : "border border-[var(--border-accent)] text-[var(--text-muted)]"}`}>
                  {product.is_global ? t("pantry.global") : t("pantry.custom")}
                </span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-4 gap-y-1 text-[10px] text-[var(--text-muted)] uppercase">
                <div><span className="font-bold text-[var(--text-main)]">{t("pantry.brandLabel")}:</span>{" "}<span className="truncate block font-mono">{product.brand ?? "—"}</span></div>
                <div><span className="font-bold text-[var(--text-main)]">{t("pantry.category")}:</span>{" "}<span className="truncate block font-mono">{category ? category.name : t("pantry.filterCategory")}</span></div>
                <div><span className="font-bold text-[var(--text-main)]">{t("pantry.barcodeLabel")}:</span>{" "}<span className="truncate block font-mono">{product.barcode ?? "—"}</span></div>
                <div><span className="font-bold text-[var(--text-main)]">{t("pantry.minStockLabel")}:</span>{" "}<span className="truncate block font-mono">{product.minimum_stock} {product.base_unit}</span></div>
              </div>
            </div>

            <button
              type="button"
              onClick={() =>
                openChat({
                  sourceApp: "pantry",
                  entityType: "product",
                  entityId: product.id,
                  entityData: {
                    name: product.name,
                    barcode: product.barcode,
                    brand: product.brand,
                    minimum_stock: product.minimum_stock,
                    base_unit: product.base_unit,
                  },
                })
              }
              aria-label={`${t("pantry.askAlfi")}: ${product.name}`}
              title={t("pantry.askAlfiAboutProduct")}
              className="p-1.5 rounded-lg border border-[var(--border-subtle)] hover:border-[var(--primary-main)] bg-[var(--surface-canvas)] hover:bg-[var(--surface-card)] transition-colors cursor-pointer shrink-0 self-start md:self-center flex items-center gap-1.5"
            >
              <AlfiAvatar status="idle" size="sm" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
