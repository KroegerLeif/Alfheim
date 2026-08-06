"use client";

import { ClipboardList, Award, RefreshCw, UserCheck } from "lucide-react";

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
  return (
    <div className="min-h-[220px] mb-6">
      {/* Step 1: Details */}
      {currentStep === 1 && (
        <div className="space-y-4">
          <h2 className="font-heading text-xl font-bold uppercase text-[var(--text-main)]">
            Chore Details
          </h2>
          <div className="space-y-2">
            <label className="text-xs font-mono uppercase text-[var(--text-muted)]">Task Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Wash Kitchen Dishes"
              className={`w-full px-4 py-2 border bg-[var(--surface-elevated)] text-[var(--text-main)] focus:outline-none rounded ${
                errors.name ? "border-red-500 focus:border-red-500" : "border-[var(--border-subtle)] focus:border-[var(--border-accent)]"
              }`}
            />
            {errors.name && <p className="text-red-500 text-xs font-mono mt-1">{errors.name}</p>}
          </div>
          <div className="space-y-2">
            <label className="text-xs font-mono uppercase text-[var(--text-muted)]">Instructions</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe how to perform the chore..."
              rows={3}
              className={`w-full px-4 py-2 border bg-[var(--surface-elevated)] text-[var(--text-main)] focus:outline-none rounded ${
                errors.description ? "border-red-500 focus:border-red-500" : "border-[var(--border-subtle)] focus:border-[var(--border-accent)]"
              }`}
            />
            {errors.description && <p className="text-red-500 text-xs font-mono mt-1">{errors.description}</p>}
          </div>
        </div>
      )}

      {/* Step 2: Points */}
      {currentStep === 2 && (
        <div className="space-y-4">
          <h2 className="font-heading text-xl font-bold uppercase text-[var(--text-main)]">
            Importance & Reward
          </h2>
          <div className="space-y-2">
            <label className="text-xs font-mono uppercase text-[var(--text-muted)]">Select Points</label>
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
                  {pts} PTS
                  <span className="block text-[9px] font-normal uppercase tracking-wider text-[var(--text-muted)] mt-1">
                    {pts === 10 ? "Standard" : pts === 15 ? "Medium" : "Urgent"}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Step 3: Reset Rules */}
      {currentStep === 3 && (
        <div className="space-y-4">
          <h2 className="font-heading text-xl font-bold uppercase text-[var(--text-main)]">
            Daily Expiry Rules
          </h2>
          <p className="text-xs text-[var(--text-muted)] leading-relaxed">
            If the task is not completed by midnight, how should the tracking engine handle it?
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
                  Non-Cumulative Reset (Recommended)
                </span>
                <span className="text-xs text-[var(--text-muted)] block mt-0.5">
                  Unfinished tasks expire at midnight, marking them missed and resetting household streaks.
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
                  Cumulative Stacking
                </span>
                <span className="text-xs text-[var(--text-muted)] block mt-0.5">
                  Keep the task pending across days. Does not affect streaks upon day reset.
                </span>
              </div>
            </button>
          </div>
        </div>
      )}

      {/* Step 4: Assignment Rules */}
      {currentStep === 4 && (
        <div className="space-y-4">
          <h2 className="font-heading text-xl font-bold uppercase text-[var(--text-main)]">
            Assignment Rules
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
                <span className="font-semibold text-sm block text-[var(--text-main)]">Open Claim</span>
                <span className="text-xs text-[var(--text-muted)] block mt-0.5">
                  Anyone in the household can claim and complete this chore on their dashboard.
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
                <span className="font-semibold text-sm block text-[var(--text-main)]">Assign Creator</span>
                <span className="text-xs text-[var(--text-muted)] block mt-0.5">
                  Automatically schedules tasks assigned directly to the member who creates them.
                </span>
              </div>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
