"use client";

import { useHouseholdPermission, useTranslation } from "@alfheim/shared";
import { WizardSteps } from "./WizardSteps";

export function WizardView() {
  const { t } = useTranslation();
  const write = useHouseholdPermission("write");

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="text-center select-none max-w-xl mx-auto">
        <h1 className="font-heading text-3xl font-extrabold text-[var(--text-main)] uppercase tracking-wide">
          {t("chores.wizardTitle")}
        </h1>
        <p className="text-xs text-[var(--text-muted)] font-mono uppercase mt-1">
          {t("chores.wizardSubtitle")}
        </p>
      </div>

      {write.allowed ? (
        <WizardSteps />
      ) : (
        <p role="note" className="text-center text-sm text-[var(--text-muted)]">
          {write.hint}
        </p>
      )}
    </div>
  );
}
