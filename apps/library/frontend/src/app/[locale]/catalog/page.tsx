"use client";

import React from "react";
import { Button, useTranslation } from "@alfheim/shared";
import {
  CatalogFilterBar,
  CatalogGrid,
  useCatalog,
} from "@/features/catalog";

export default function CatalogPage() {
  const { t } = useTranslation();
  const {
    category,
    setCategory,
    query,
    setQuery,
    isCookbook,
    setIsCookbook,
    activeProvidersOnly,
    setActiveProvidersOnly,
    items,
    isLoading,
    locationsMap,
  } = useCatalog();

  return (
    <div className="space-y-6 p-6 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-[var(--text-main,#f8fafc)]">
            {t("library.catalog.title")}
          </h1>
          <p className="text-xs sm:text-sm text-[var(--text-muted,#94a3b8)] mt-1">
            {t("library.catalog.subtitle")}
          </p>
        </div>

        <Button type="button" variant="default" size="sm">
          + {t("library.catalog.addItem")}
        </Button>
      </div>

      <CatalogFilterBar
        category={category}
        setCategory={setCategory}
        query={query}
        setQuery={setQuery}
        isCookbook={isCookbook}
        setIsCookbook={setIsCookbook}
        activeProvidersOnly={activeProvidersOnly}
        setActiveProvidersOnly={setActiveProvidersOnly}
      />

      <CatalogGrid
        items={items}
        isLoading={isLoading}
        locationsMap={locationsMap}
      />
    </div>
  );
}
