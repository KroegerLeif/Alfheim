"use client";

import * as React from "react";
import { useTranslation } from "@loeger-os/shared";
import { useProducts, useSearchProducts } from "../services/productService";
import { useCategories } from "@/features/categories/services/categoryService";
import { Search } from "lucide-react";
import { ProductList } from "./ProductList";
import { ProductCreateForm } from "./ProductCreateForm";

/**
 * ProductCatalogView
 * Orchestrates the product blueprint master data panel:
 * - Left panel: searchable ProductList
 * - Right panel: ProductCreateForm
 */
export function ProductCatalogView() {
  const { t } = useTranslation();
  const [searchQuery, setSearchQuery] = React.useState("");
  const [debouncedQuery, setDebouncedQuery] = React.useState("");

  React.useEffect(() => {
    const handler = setTimeout(() => setDebouncedQuery(searchQuery), 300);
    return () => clearTimeout(handler);
  }, [searchQuery]);

  const { data: allProducts = [], isLoading: isLoadingAll } = useProducts();
  const { data: searchResults = [], isLoading: isSearching } = useSearchProducts(debouncedQuery);
  const { data: categories = [] } = useCategories();

  const isSearchActive = debouncedQuery.trim().length > 0;
  const products = isSearchActive ? searchResults : allProducts;
  const isLoadingList = isSearchActive ? isSearching : isLoadingAll;

  return (
    <div className="flex-1 max-h-screen overflow-hidden grid grid-cols-1 lg:grid-cols-3 text-[var(--text-main)]">
      {/* Left: Product list panel */}
      <div className="lg:col-span-2 p-8 flex flex-col gap-6 overflow-hidden bg-[var(--surface-canvas)]">
        <header className="border-b border-[var(--border-subtle)] pb-4">
          <h1 className="text-4xl font-heading font-black tracking-wide text-[var(--text-main)] uppercase">{t("pantry.productsTitle")}</h1>
          <p className="text-xs text-[var(--text-muted)] mt-1 uppercase tracking-wider font-mono">{t("pantry.productsSub")}</p>
        </header>

        {/* Search bar */}
        <div className="relative">
          <Search className="absolute left-3 top-3.5 h-4 w-4 text-[var(--text-muted)]" />
          <input type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={t("pantry.searchPlaceholder")}
            className="w-full pl-9 pr-4 py-3 border border-[var(--border-subtle)] bg-[var(--surface-card)] text-[var(--text-main)] focus:outline-none focus:border-[var(--primary-main)] text-sm h-11 rounded" />
        </div>

        <ProductList products={products} categories={categories} isLoading={isLoadingList} />
      </div>

      {/* Right: Create form */}
      <ProductCreateForm />
    </div>
  );
}
