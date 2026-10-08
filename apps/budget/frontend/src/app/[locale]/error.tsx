"use client";

import { useEffect } from "react";
import { useTranslation } from "@alfheim/shared";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const { t } = useTranslation();

  useEffect(() => {
    console.error("[Budget] Unhandled page error:", error);
  }, [error]);

  return (
    <div className="flex-1 flex flex-col items-center justify-center p-8 gap-4 text-center">
      <div className="glass-card max-w-md w-full min-w-0 p-6 rounded-2xl border border-red-500/20 space-y-4">
        <div
          aria-hidden="true"
          className="h-12 w-12 rounded-xl bg-red-500/10 text-red-400 flex items-center justify-center mx-auto text-xl font-bold"
        >
          !
        </div>
        <h2 className="text-lg font-bold text-foreground uppercase tracking-wide">
          {t("common.error_boundary.title")}
        </h2>
        <p className="text-xs text-muted-foreground break-words">
          {error.message || t("common.error_boundary.description")}
        </p>
        <button
          type="button"
          onClick={reset}
          className="px-4 py-2 rounded-xl bg-primary text-primary-foreground font-heading text-xs font-extrabold uppercase tracking-wider transition-colors cursor-pointer"
        >
          {t("common.error_boundary.retry")}
        </button>
      </div>
    </div>
  );
}
