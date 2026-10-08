"use client";

import { useCallback } from "react";
import { useLocale, useTranslations } from "next-intl";
import { formatDate } from "./utils";

/**
 * Returns a date formatter bound to the active UI language. Missing dates render as a localized
 * placeholder: "Never" for events that did not happen yet (`never`), "Not scheduled" for due dates
 * that were not set (`notScheduled`, the default).
 */
export function useFormatDate() {
  const locale = useLocale();
  const t = useTranslations("maintenance");

  return useCallback(
    (value: string | null | undefined, emptyAs: "notScheduled" | "never" = "notScheduled"): string => {
      const formatted = formatDate(value, locale);
      if (formatted !== null) return formatted;
      return emptyAs === "never" ? t("dates.never") : t("dates.notScheduled");
    },
    [locale, t],
  );
}
