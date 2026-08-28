"use client";

import { useTranslation } from "@alfheim/shared";

export default function ProvidersPage() {
  const { t } = useTranslation();

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">{t("library.titles.providers")}</h1>
      <p className="text-[var(--text-muted)]">
        {t("library.placeholders.providers")}
      </p>
    </div>
  );
}
