"use client";

import { useTranslation } from "@alfheim/shared";
import { WizardStepRules } from "./WizardStepRules";

interface WizardStepContentProps {
  currentStep: number;
  name: string;
  setName: (val: string) => void;
  description: string;
  setDescription: (val: string) => void;
  points: number;
  setPoints: (val: number) => void;
  isNonCumulative: boolean;
  setIsNonCumulative: (val: boolean) => void;
  assignmentType: string;
  setAssignmentType: (val: string) => void;
  errors: Record<string, string>;
}

export function WizardStepContent({
  currentStep,
  name,
  setName,
  description,
  setDescription,
  points,
  setPoints,
  isNonCumulative,
  setIsNonCumulative,
  assignmentType,
  setAssignmentType,
  errors,
}: WizardStepContentProps) {
  const { t } = useTranslation();

  return (
    <div className="min-h-[220px] mb-6">
      {currentStep === 1 && (
        <div className="space-y-4">
          <h2 className="font-heading text-xl font-bold uppercase text-[var(--text-main)]">
            {t("chores.choreDetails")}
          </h2>
          <div className="space-y-2">
            <label className="text-xs font-mono uppercase text-[var(--text-muted)]">
              {t("chores.taskName")}
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t("chores.taskNamePlaceholder")}
              className={`w-full px-4 py-2 border bg-[var(--surface-elevated)] text-[var(--text-main)] focus:outline-none rounded ${
                errors.name ? "border-red-500 focus:border-red-500" : "border-[var(--border-subtle)] focus:border-[var(--border-accent)]"
              }`}
            />
            {errors.name && <p className="text-red-500 text-xs font-mono mt-1">{errors.name}</p>}
          </div>
          <div className="space-y-2">
            <label className="text-xs font-mono uppercase text-[var(--text-muted)]">
              {t("chores.instructions")}
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={t("chores.instructionsPlaceholder")}
              rows={3}
              className={`w-full px-4 py-2 border bg-[var(--surface-elevated)] text-[var(--text-main)] focus:outline-none rounded ${
                errors.description ? "border-red-500 focus:border-red-500" : "border-[var(--border-subtle)] focus:border-[var(--border-accent)]"
              }`}
            />
            {errors.description && <p className="text-red-500 text-xs font-mono mt-1">{errors.description}</p>}
          </div>
        </div>
      )}

      {currentStep === 2 && (
        <div className="space-y-4">
          <h2 className="font-heading text-xl font-bold uppercase text-[var(--text-main)]">
            {t("chores.importanceReward")}
          </h2>
          <div className="space-y-2">
            <label className="text-xs font-mono uppercase text-[var(--text-muted)]">
              {t("chores.selectPoints")}
            </label>
            <div className="grid grid-cols-3 gap-3">
              {[10, 15, 30].map((pts) => (
                <button
                  key={pts}
                  type="button"
                  onClick={() => setPoints(pts)}
                  className={`py-3 border font-mono font-bold text-center cursor-pointer transition-colors rounded ${
                    points === pts
                      ? "border-[var(--primary-main)] bg-[var(--primary-main)]/10 text-[var(--primary-main)]"
                      : "border-[var(--border-subtle)] text-[var(--text-muted)] hover:border-[var(--border-accent)]"
                  }`}
                >
                  {pts} {t("chores.pts").toUpperCase()}
                  <span className="block text-[9px] font-normal uppercase tracking-wider text-[var(--text-muted)] mt-1">
                    {pts === 10 ? t("chores.standard") : pts === 15 ? t("chores.medium") : t("chores.urgent")}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      <WizardStepRules
        currentStep={currentStep}
        isNonCumulative={isNonCumulative}
        setIsNonCumulative={setIsNonCumulative}
        assignmentType={assignmentType}
        setAssignmentType={setAssignmentType}
      />
    </div>
  );
}
