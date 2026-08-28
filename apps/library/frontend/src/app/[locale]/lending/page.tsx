"use client";

import { useTranslation } from "@alfheim/shared";

export default function LendingPage() {
  const { t } = useTranslation();

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">{t("library.titles.lending")}</h1>
      <p className="text-[var(--text-muted)]">
        {t("library.placeholders.lending")}
      </p>
    </div>
  );
}
