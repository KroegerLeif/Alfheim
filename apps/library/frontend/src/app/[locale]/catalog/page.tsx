"use client";

import React, { useState } from "react";
import { Button, useTranslation } from "@alfheim/shared";
import {
  CatalogFilterBar,
  CatalogGrid,
  useCatalog,
} from "@/features/catalog";
import { MediaItem } from "@/features/catalog/types";
import { ItemDialog } from "@/features/item-dialog";

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
    locations,
    refetch,
  } = useCatalog();

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<MediaItem | null>(null);

  const handleOpenAddDialog = () => {
    setEditingItem(null);
    setIsDialogOpen(true);
  };

  const handleOpenEditDialog = (item: MediaItem) => {
    setEditingItem(item);
    setIsDialogOpen(true);
  };

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

        <Button type="button" variant="default" size="sm" onClick={handleOpenAddDialog}>
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
        onEditItem={handleOpenEditDialog}
      />

      <ItemDialog
        open={isDialogOpen}
        onOpenChange={setIsDialogOpen}
        item={editingItem}
        locations={locations}
        onSuccess={refetch}
      />
    </div>
  );
}
