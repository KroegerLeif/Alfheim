"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "@alfheim/shared";

/**
 * Tracks the submit state of a dialog form. A failed request keeps the dialog open and exposes a
 * message for `FormError` instead of rejecting unhandled; the error resets whenever the dialog
 * is opened or closed.
 */
export function useFormSubmit(open: boolean) {
  const { t } = useTranslation();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setError(null);
  }, [open]);

  /** Runs `action`; resolves to `true` on success and `false` when it failed. */
  const run = useCallback(
    async (action: () => Promise<void>): Promise<boolean> => {
      setSubmitting(true);
      setError(null);
      try {
        await action();
        return true;
      } catch (err) {
        setError(err instanceof Error && err.message ? err.message : t("budget.errors.requestFailed"));
        return false;
      } finally {
        setSubmitting(false);
      }
    },
    [t]
  );

  return { submitting, error, run };
}
