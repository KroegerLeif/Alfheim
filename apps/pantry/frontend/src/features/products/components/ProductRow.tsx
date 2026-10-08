"use client";

import * as React from "react";
import { AlfiAvatar, useTranslation } from "@alfheim/shared";
import { Pencil, Trash2 } from "lucide-react";
import { usePantryChat } from "@/core/chatContext";
import { DeleteConfirmDialog } from "@/components/shared/DeleteConfirmDialog";
import { CategoryRead } from "@/features/categories/types";
import { ProductRead } from "../types";
import { useDeleteProduct } from "../services/productService";
import { ProductEditDialog } from "./ProductEditDialog";

interface ProductRowProps {
  product: ProductRead;
  category: CategoryRead | undefined;
}

const ICON_BUTTON =
  "p-1.5 rounded-lg border border-[var(--border-subtle)] hover:border-[var(--primary-main)] bg-[var(--surface-canvas)] hover:bg-[var(--surface-card)] transition-colors cursor-pointer shrink-0 flex items-center";

/**
 * ProductRow
 * One product blueprint with its metadata, an ALFI trigger and, for custom products, edit and
 * delete actions. Global catalog templates are read-only on the server and therefore have none.
 */
export function ProductRow({ product, category }: ProductRowProps) {
  const { t } = useTranslation();
  const { openChat } = usePantryChat();
  const deleteProductMut = useDeleteProduct();
  const [isEditing, setIsEditing] = React.useState(false);
  const [isDeleting, setIsDeleting] = React.useState(false);

  return (
    <div className="border border-[var(--border-subtle)] p-4 bg-[var(--surface-card)] hover:border-[var(--border-accent)] transition-all flex flex-col md:flex-row md:items-center justify-between gap-4 rounded-lg shadow-sm">
      <div className="space-y-1.5 flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap min-w-0">
          <span className="font-heading text-lg font-bold uppercase truncate max-w-full tracking-wide text-[var(--text-main)]" title={product.name}>
            {product.name}
          </span>
          <span className={`text-[9px] font-bold px-1.5 py-0.5 uppercase rounded shrink-0 ${product.is_global ? "bg-[var(--primary-main)] text-black" : "border border-[var(--border-accent)] text-[var(--text-muted)]"}`}>
            {product.is_global ? t("pantry.global") : t("pantry.custom")}
          </span>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-4 gap-y-1 text-[10px] text-[var(--text-muted)] uppercase">
          <div className="min-w-0"><span className="font-bold text-[var(--text-main)]">{t("pantry.brandLabel")}:</span>{" "}<span className="truncate block font-mono" title={product.brand ?? undefined}>{product.brand ?? "—"}</span></div>
          <div className="min-w-0"><span className="font-bold text-[var(--text-main)]">{t("pantry.category")}:</span>{" "}<span className="truncate block font-mono" title={category?.name}>{category ? category.name : t("pantry.noCategory")}</span></div>
          <div className="min-w-0"><span className="font-bold text-[var(--text-main)]">{t("pantry.barcodeLabel")}:</span>{" "}<span className="truncate block font-mono" title={product.barcode ?? undefined}>{product.barcode ?? "—"}</span></div>
          <div className="min-w-0"><span className="font-bold text-[var(--text-main)]">{t("pantry.minStockLabel")}:</span>{" "}<span className="truncate block font-mono">{product.minimum_stock} {product.base_unit}</span></div>
        </div>
      </div>

      <div className="flex items-center gap-2 shrink-0 self-start md:self-center">
        {!product.is_global && (
          <>
            <button type="button" onClick={() => setIsEditing(true)} className={ICON_BUTTON}
              aria-label={`${t("pantry.edit.product")}: ${product.name}`} title={t("pantry.edit.product")}>
              <Pencil className="h-4 w-4" />
            </button>
            <button type="button" onClick={() => setIsDeleting(true)} className={`${ICON_BUTTON} hover:text-red-400`}
              aria-label={`${t("pantry.delete.product")}: ${product.name}`} title={t("pantry.delete.product")}>
              <Trash2 className="h-4 w-4" />
            </button>
          </>
        )}
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
          className={`${ICON_BUTTON} gap-1.5`}
        >
          <AlfiAvatar status="idle" size="sm" />
        </button>
      </div>

      {isEditing && <ProductEditDialog product={product} onClose={() => setIsEditing(false)} />}
      <DeleteConfirmDialog
        open={isDeleting}
        onClose={() => setIsDeleting(false)}
        title={t("pantry.delete.productTitle")}
        question={t("pantry.delete.productQuestion")}
        name={product.name}
        onConfirm={() => deleteProductMut.mutateAsync(product.id)}
        failureKey="pantry.errors.deleteProductFailed"
        codeKeys={{ product_in_use: "pantry.errors.productInUse" }}
      />
    </div>
  );
}
