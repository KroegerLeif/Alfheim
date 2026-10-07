"use client";

import { useTranslation } from "@alfheim/shared";

export default function Loading() {
  const { t } = useTranslation();

  return (
    <div className="flex-1 flex items-center justify-center">
      <div role="status" className="flex flex-col items-center gap-4">
        <div
          aria-hidden="true"
          className="h-10 w-10 animate-spin rounded-full border-4 border-[var(--primary-main)] border-t-transparent"
        ></div>
        <p className="text-sm font-mono tracking-wide text-[var(--text-muted)]">{t("workout.loading")}</p>
      </div>
    </div>
  );
}
