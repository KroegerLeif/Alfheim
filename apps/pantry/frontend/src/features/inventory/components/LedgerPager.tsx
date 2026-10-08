"use client";

import { Button, useTranslation } from "@alfheim/shared";
import { ChevronLeft, ChevronRight } from "lucide-react";

interface LedgerPagerProps {
  /** Zero-based page index. */
  page: number;
  hasNext: boolean;
  isFetching: boolean;
  onPrevious: () => void;
  onNext: () => void;
}

/**
 * LedgerPager
 * Newer/older controls for the paged ledger history.
 */
export function LedgerPager({ page, hasNext, isFetching, onPrevious, onNext }: LedgerPagerProps) {
  const { t } = useTranslation();

  return (
    <nav aria-label={t("pantry.pager.label")} className="flex items-center justify-between gap-3">
      <Button type="button" variant="outline" size="sm" onClick={onPrevious} disabled={page === 0 || isFetching}
        className="text-xs uppercase gap-1">
        <ChevronLeft className="h-3 w-3" />{t("pantry.pager.newer")}
      </Button>
      <span className="text-[10px] text-[var(--text-muted)] uppercase tracking-wider font-mono">
        {t("pantry.pager.page", { page: page + 1 })}
      </span>
      <Button type="button" variant="outline" size="sm" onClick={onNext} disabled={!hasNext || isFetching}
        className="text-xs uppercase gap-1">
        {t("pantry.pager.older")}<ChevronRight className="h-3 w-3" />
      </Button>
    </nav>
  );
}
