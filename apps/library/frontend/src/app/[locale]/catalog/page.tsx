"use client";

import { useTranslation } from "@alfheim/shared";

export default function CatalogPage() {
  const { t } = useTranslation();

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">{t("library.titles.catalog")}</h1>
      <p className="text-[var(--text-muted)]">
        {t("library.placeholders.catalog")}
      </p>
    </div>
  );
}
