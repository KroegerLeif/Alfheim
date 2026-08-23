"use client";

import { useTranslation } from "@alfheim/shared";

interface WizardStepRulesProps {
  currentStep: number;
  isNonCumulative: boolean;
  setIsNonCumulative: (val: boolean) => void;
  assignmentType: string;
  setAssignmentType: (val: string) => void;
}

export function WizardStepRules({
  currentStep,
  isNonCumulative,
  setIsNonCumulative,
  assignmentType,
  setAssignmentType,
}: WizardStepRulesProps) {
  const { t } = useTranslation();

  if (currentStep === 3) {
    return (
      <div className="space-y-4">
        <h2 className="font-heading text-xl font-bold uppercase text-[var(--text-main)]">
          {t("chores.dailyExpiryRules")}
        </h2>
        <p className="text-xs text-[var(--text-muted)] leading-relaxed">
          {t("chores.dailyExpiryDesc")}
        </p>
        <div className="space-y-3">
          <button
            type="button"
            onClick={() => setIsNonCumulative(true)}
            className={`w-full text-left p-4 border flex items-start gap-3 transition-colors cursor-pointer rounded ${
              isNonCumulative
                ? "border-[var(--primary-main)] bg-[var(--primary-main)]/15"
                : "border-[var(--border-subtle)] hover:border-[var(--border-accent)]"
            }`}
          >
            <div className="h-5 w-5 border border-[var(--primary-main)] flex items-center justify-center rounded-full mt-0.5">
              {isNonCumulative && <div className="h-2.5 w-2.5 bg-[var(--primary-main)] rounded-full" />}
            </div>
            <div>
              <span className="font-semibold text-sm block text-[var(--text-main)]">
                {t("chores.nonCumulativeTitle")}
              </span>
              <span className="text-xs text-[var(--text-muted)] block mt-0.5">
                {t("chores.nonCumulativeDesc")}
              </span>
            </div>
          </button>

          <button
            type="button"
            onClick={() => setIsNonCumulative(false)}
            className={`w-full text-left p-4 border flex items-start gap-3 transition-colors cursor-pointer rounded ${
              !isNonCumulative
                ? "border-[var(--primary-main)] bg-[var(--primary-main)]/15"
                : "border-[var(--border-subtle)] hover:border-[var(--border-accent)]"
            }`}
          >
            <div className="h-5 w-5 border border-[var(--primary-main)] flex items-center justify-center rounded-full mt-0.5">
              {!isNonCumulative && <div className="h-2.5 w-2.5 bg-[var(--primary-main)] rounded-full" />}
            </div>
            <div>
              <span className="font-semibold text-sm block text-[var(--text-main)]">
                {t("chores.cumulativeTitle")}
              </span>
              <span className="text-xs text-[var(--text-muted)] block mt-0.5">
                {t("chores.cumulativeDesc")}
              </span>
            </div>
          </button>
        </div>
      </div>
    );
  }

  if (currentStep === 4) {
    return (
      <div className="space-y-4">
        <h2 className="font-heading text-xl font-bold uppercase text-[var(--text-main)]">
          {t("chores.assignmentRules")}
        </h2>
        <div className="space-y-3">
          <button
            type="button"
            onClick={() => setAssignmentType("open")}
            className={`w-full text-left p-4 border flex items-start gap-3 transition-colors cursor-pointer rounded ${
              assignmentType === "open"
                ? "border-[var(--primary-main)] bg-[var(--primary-main)]/15"
                : "border-[var(--border-subtle)] hover:border-[var(--border-accent)]"
            }`}
          >
            <div className="h-5 w-5 border border-[var(--primary-main)] flex items-center justify-center rounded-full mt-0.5">
              {assignmentType === "open" && <div className="h-2.5 w-2.5 bg-[var(--primary-main)] rounded-full" />}
            </div>
            <div>
              <span className="font-semibold text-sm block text-[var(--text-main)]">{t("chores.openClaim")}</span>
              <span className="text-xs text-[var(--text-muted)] block mt-0.5">
                {t("chores.openClaimDesc")}
              </span>
            </div>
          </button>

          <button
            type="button"
            onClick={() => setAssignmentType("specific")}
            className={`w-full text-left p-4 border flex items-start gap-3 transition-colors cursor-pointer rounded ${
              assignmentType === "specific"
                ? "border-[var(--primary-main)] bg-[var(--primary-main)]/15"
                : "border-[var(--border-subtle)] hover:border-[var(--border-accent)]"
            }`}
          >
            <div className="h-5 w-5 border border-[var(--primary-main)] flex items-center justify-center rounded-full mt-0.5">
              {assignmentType === "specific" && <div className="h-2.5 w-2.5 bg-[var(--primary-main)] rounded-full" />}
            </div>
            <div>
              <span className="font-semibold text-sm block text-[var(--text-main)]">{t("chores.assignCreator")}</span>
              <span className="text-xs text-[var(--text-muted)] block mt-0.5">
                {t("chores.assignCreatorDesc")}
              </span>
            </div>
          </button>
        </div>
      </div>
    );
  }

  return null;
}
