"use client";

import { useTranslation } from "@alfheim/shared";

export default function LocationsPage() {
  const { t } = useTranslation();

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">{t("library.titles.locations")}</h1>
      <p className="text-[var(--text-muted)]">
        {t("library.placeholders.locations")}
      </p>
    </div>
  );
}
