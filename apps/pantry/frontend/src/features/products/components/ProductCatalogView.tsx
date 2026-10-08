"use client";

import * as React from "react";
import { useTranslation } from "@alfheim/shared";
import { useProducts, useSearchProducts } from "../services/productService";
import { useCategories } from "@/features/categories/services/categoryService";
import { Search } from "lucide-react";
import { ProductList } from "./ProductList";
import { ProductCreateForm } from "./ProductCreateForm";
import { CategoryManager } from "@/features/categories/components/CategoryManager";
import { ErrorBanner } from "@/components/shared/ErrorBanner";

/**
 * ProductCatalogView
 * Orchestrates the product blueprint master data panel:
 * - Left panel: searchable ProductList
 * - Right panel: ProductCreateForm and CategoryManager
 */
export function ProductCatalogView() {
  const { t } = useTranslation();
  const [searchQuery, setSearchQuery] = React.useState("");
  const [debouncedQuery, setDebouncedQuery] = React.useState("");

  React.useEffect(() => {
    const handler = setTimeout(() => setDebouncedQuery(searchQuery), 300);
    return () => clearTimeout(handler);
  }, [searchQuery]);

  const { data: allProductsData, isLoading: isLoadingAll, isError: isAllError } = useProducts();
  const allProducts = allProductsData ?? [];
  const { data: searchResultsData, isLoading: isSearching, isError: isSearchError } = useSearchProducts(debouncedQuery);
  const searchResults = searchResultsData ?? [];
  const { data: categoriesData, isError: isCategoriesError } = useCategories();
  const categories = categoriesData ?? [];

  const isSearchActive = debouncedQuery.trim().length > 0;
  const products = isSearchActive ? searchResults : allProducts;
  const isLoadingList = isSearchActive ? isSearching : isLoadingAll;
  const isErrorList = (isSearchActive ? isSearchError : isAllError) || isCategoriesError;

  return (
    <div className="flex-1 lg:max-h-screen lg:overflow-hidden grid grid-cols-1 lg:grid-cols-3 text-[var(--text-main)]">
      {/* Left: Product list panel */}
      <div className="lg:col-span-2 p-4 sm:p-8 flex flex-col gap-6 overflow-hidden bg-[var(--surface-canvas)] min-w-0">
        <header className="border-b border-[var(--border-subtle)] pb-4">
          <h1 className="text-2xl sm:text-4xl font-heading font-black tracking-wide text-[var(--text-main)] uppercase">{t("pantry.productsTitle")}</h1>
          <p className="text-xs text-[var(--text-muted)] mt-1 uppercase tracking-wider font-mono">{t("pantry.productsSub")}</p>
        </header>

        {/* Search bar */}
        <div className="relative">
          <Search className="absolute left-3 top-3.5 h-4 w-4 text-[var(--text-muted)]" />
          <input type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={t("pantry.searchPlaceholder")} aria-label={t("pantry.searchPlaceholder")}
            className="w-full pl-9 pr-4 py-3 border border-[var(--border-subtle)] bg-[var(--surface-card)] text-[var(--text-main)] focus:outline-none focus:border-[var(--primary-main)] text-sm h-11 rounded" />
        </div>

        {isErrorList && <ErrorBanner message={t("pantry.errors.loadProducts")} />}

        <ProductList products={products} categories={categories} isLoading={isLoadingList} />
      </div>

      {/* Right: Create form and category management */}
      <div className="lg:col-span-1 bg-[var(--surface-elevated)] overflow-y-auto min-w-0">
        <ProductCreateForm />
        <CategoryManager />
      </div>
    </div>
  );
}
