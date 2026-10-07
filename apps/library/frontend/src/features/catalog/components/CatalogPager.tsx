import React from "react";
import { Button, useTranslation } from "@alfheim/shared";

interface CatalogPagerProps {
  shown: number;
  total: number;
  hasMore: boolean;
  isLoadingMore: boolean;
  isLoadMoreError: boolean;
  onLoadMore: () => void;
}

/** Shows how much of the catalog is loaded and offers to fetch the next page. */
export function CatalogPager({
  shown,
  total,
  hasMore,
  isLoadingMore,
  isLoadMoreError,
  onLoadMore,
}: CatalogPagerProps) {
  const { t } = useTranslation();

  if (total === 0) return null;

  return (
    <div className="flex flex-col items-center gap-2 pt-2">
      <p className="text-xs text-[var(--text-muted)]">
        {t("library.catalog.showing", { shown, total })}
      </p>
      {isLoadMoreError && (
        <p role="alert" className="text-xs text-red-400">
          {t("library.catalog.loadMoreError")}
        </p>
      )}
      {hasMore && (
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={isLoadingMore}
          onClick={onLoadMore}
        >
          {isLoadingMore
            ? t("library.catalog.loadingMore")
            : t("library.catalog.loadMore")}
        </Button>
      )}
    </div>
  );
}
