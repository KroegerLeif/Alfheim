"use client";

import React, { useState } from "react";
import { Button, useHouseholdCan, useTranslation } from "@alfheim/shared";
import {
  CatalogFilterBar,
  CatalogGrid,
  CatalogPager,
  useCatalog,
} from "@/features/catalog";
import { MediaItem } from "@/features/catalog/types";
import { ItemDialog } from "@/features/item-dialog";
import { LendItemDialog, useCatalogLending } from "@/features/lending";

export default function CatalogPage() {
  const { t } = useTranslation();
  const canWrite = useHouseholdCan("write");
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
    total,
    hasMore,
    loadMore,
    isLoadingMore,
    isLoadMoreError,
    isLoading,
    isError,
    locationsMap,
    locations,
    providers,
    refetch,
  } = useCatalog();

  const lending = useCatalogLending(refetch);
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
        <div className="min-w-0">
          <h1 className="text-2xl font-bold tracking-tight text-[var(--text-main)]">
            {t("library.catalog.title")}
          </h1>
          <p className="text-xs sm:text-sm text-[var(--text-muted)] mt-1">
            {t("library.catalog.subtitle")}
          </p>
        </div>

        {canWrite && (
          <Button type="button" variant="default" size="sm" onClick={handleOpenAddDialog}>
            + {t("library.catalog.addItem")}
          </Button>
        )}
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

      {lending.returnError && (
        <div role="alert" className="rounded-lg border border-red-500/20 bg-red-500/10 p-3 text-xs text-red-400">
          {t("library.lending.returnError")}
        </div>
      )}

      <CatalogGrid
        items={items}
        isLoading={isLoading}
        isError={isError}
        locationsMap={locationsMap}
        onEditItem={handleOpenEditDialog}
        onLendItem={canWrite ? lending.openLendDialog : undefined}
        onReturnItem={canWrite ? (item) => void lending.returnItem(item) : undefined}
      />

      {!isLoading && !isError && (
        <CatalogPager
          shown={items.length}
          total={total}
          hasMore={hasMore}
          isLoadingMore={isLoadingMore}
          isLoadMoreError={isLoadMoreError}
          onLoadMore={() => void loadMore()}
        />
      )}

      <ItemDialog
        open={isDialogOpen}
        onOpenChange={setIsDialogOpen}
        item={editingItem}
        locations={locations}
        providers={providers}
        onSuccess={refetch}
      />

      <LendItemDialog
        open={lending.lendingItem !== null}
        onOpenChange={(open) => {
          if (!open) lending.closeLendDialog();
        }}
        itemTitle={lending.lendingItem?.title}
        onSubmit={lending.submitLend}
      />
    </div>
  );
}
