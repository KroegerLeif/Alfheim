import React from "react";
import { TriangleAlert } from "lucide-react";
import { useTranslation } from "@alfheim/shared";

/** Error state shown when the lending history could not be loaded. */
export function LendingLoadError() {
  const { t } = useTranslation();

  return (
    <div
      role="alert"
      className="rounded-2xl border border-dashed border-red-500/20 bg-red-500/5 p-8 text-center text-xs text-[var(--text-muted)]"
    >
      <div className="mb-2 inline-flex h-8 w-8 items-center justify-center rounded-full bg-red-500/10 text-red-400">
        <TriangleAlert className="h-4 w-4" aria-hidden="true" />
      </div>
      <div className="font-semibold text-[var(--text-main)]">
        {t("library.lending.errorLoadingTitle")}
      </div>
      <p className="text-xs text-[var(--text-muted)]">
        {t("library.lending.errorLoading")}
      </p>
    </div>
  );
}
