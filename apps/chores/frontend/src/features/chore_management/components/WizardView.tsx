"use client";

import { WizardSteps } from "./WizardSteps";

export function WizardView() {
  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="text-center select-none max-w-xl mx-auto">
        <h1 className="font-heading text-3xl font-extrabold text-[var(--text-main)] uppercase tracking-wide">
          Chore Creator Wizard
        </h1>
        <p className="text-xs text-[var(--text-muted)] font-mono uppercase mt-1">
          Scaffold a recurring task blueprint for your household
        </p>
      </div>

      <WizardSteps />
    </div>
  );
}
