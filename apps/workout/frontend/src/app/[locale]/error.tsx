"use client";

import { useEffect } from "react";
import { Button, useTranslation } from "@alfheim/shared";
import { RotateCcw, TriangleAlert } from "lucide-react";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const { t } = useTranslation();

  useEffect(() => {
    console.error("[Workout] Unhandled page error:", error);
  }, [error]);

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 p-8 text-center">
      <div role="alert" className="max-w-md space-y-4 rounded-2xl border border-red-500/20 p-6">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-red-500/10 text-red-400">
          <TriangleAlert className="h-6 w-6" aria-hidden="true" />
        </div>
        <h2 className="text-lg font-bold uppercase tracking-wide">{t("workout.errorTitle")}</h2>
        <p className="break-words text-xs text-[var(--text-muted)]">
          {error.message || t("workout.errorGeneric")}
        </p>
        <Button className="min-h-11" onClick={reset}>
          <RotateCcw aria-hidden="true" />
          {t("workout.retry")}
        </Button>
      </div>
    </div>
  );
}
