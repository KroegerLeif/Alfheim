"use client";

import { useTranslation } from "@alfheim/shared";
import { Loader2 } from "lucide-react";
import { ProductRead } from "@/features/products/types";
import { CategoryRead } from "@/features/categories/types";
import { ProductRow } from "./ProductRow";

interface ProductListProps {
  products: ProductRead[];
  categories: CategoryRead[];
  isLoading: boolean;
}

/**
 * ProductList
 * Renders the scrollable product blueprint feed.
 */
export function ProductList({ products, categories, isLoading }: ProductListProps) {
  const { t } = useTranslation();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12 gap-3">
        <Loader2 className="h-5 w-5 animate-spin text-[var(--primary-main)]" />
        <span className="text-xs uppercase font-bold tracking-widest text-[var(--text-muted)]">{t("pantry.syncingBlueprints")}</span>
      </div>
    );
  }

  if ((products ?? []).length === 0) {
    return (
      <div className="border border-dashed border-[var(--border-subtle)] p-8 text-center text-xs text-[var(--text-muted)] uppercase tracking-widest rounded-lg">
        {t("pantry.noProducts")}
      </div>
    );
  }

  const categoryById = new Map((categories ?? []).map((category) => [category.id, category]));

  return (
    <div className="flex-1 overflow-y-auto space-y-4 max-h-[calc(100vh-270px)] pr-2">
      {(products ?? []).map((product) => (
        <ProductRow key={product.id} product={product} category={categoryById.get(product.category_id ?? "")} />
      ))}
    </div>
  );
}
