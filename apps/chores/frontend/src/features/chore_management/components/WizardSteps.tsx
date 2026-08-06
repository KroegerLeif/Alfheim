"use client";

import { useState } from "react";
import { useCreateChoreTemplate } from "../services/choresService";
import { useRouter } from "@/navigation";
import { ClipboardList, Award, RefreshCw, UserCheck, ArrowRight, ArrowLeft } from "lucide-react";

export function WizardSteps() {
  const router = useRouter();
  const createMutation = useCreateChoreTemplate();
  const [currentStep, setCurrentStep] = useState(1);

  // Form states
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [points, setPoints] = useState(10);
  const [isNonCumulative, setIsNonCumulative] = useState(true);
  const [assignmentType, setAssignmentType] = useState("open"); // open vs specific

  const handleNext = () => {
    if (currentStep === 1 && !name.trim()) {
      alert("Please provide a name for the chore.");
      return;
    }
    if (currentStep < 4) {
      setCurrentStep((prev) => prev + 1);
    }
  };

  const handleBack = () => {
    if (currentStep > 1) {
      setCurrentStep((prev) => prev - 1);
    }
  };

  const handleSubmit = () => {
    createMutation.mutate(
      {
        name,
        description: description || undefined,
        points,
        is_non_cumulative: isNonCumulative,
      },
      {
        onSuccess: () => {
          router.push("/board");
        },
        onError: (err) => {
          alert(`Failed to create chore template: ${err.message}`);
        },
      }
    );
  };

  return (
    <div className="bg-[var(--surface-card)] border border-[var(--border-subtle)] max-w-xl mx-auto p-6 md:p-8 rounded-lg">
      {/* Step Progress indicators */}
      <div className="flex items-center justify-between mb-8 select-none font-mono text-xs text-[var(--text-muted)]">
        {[
          { step: 1, label: "Details", icon: ClipboardList },
          { step: 2, label: "Points", icon: Award },
          { step: 3, label: "Reset", icon: RefreshCw },
          { step: 4, label: "Assign", icon: UserCheck },
        ].map((s) => {
          const Icon = s.icon;
          const isActive = currentStep >= s.step;
          return (
            <div key={s.step} className="flex items-center gap-2">
              <span
                className={`h-7 w-7 flex items-center justify-center border font-bold rounded-full ${
                  isActive
                    ? "border-[var(--primary-main)] bg-[var(--primary-main)]/10 text-[var(--primary-main)]"
                    : "border-[var(--border-subtle)]"
                }`}
              >
                {s.step}
              </span>
              <span className={`hidden sm:inline ${isActive ? "text-[var(--text-main)] font-semibold" : ""}`}>
                {s.label}
              </span>
            </div>
          );
        })}
      </div>

      {/* Steps Content */}
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
                className="w-full px-4 py-2 border border-[var(--border-subtle)] bg-[var(--surface-elevated)] text-[var(--text-main)] focus:outline-none focus:border-[var(--border-accent)] rounded"
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-mono uppercase text-[var(--text-muted)]">Instructions</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Describe how to perform the chore..."
                rows={3}
                className="w-full px-4 py-2 border border-[var(--border-subtle)] bg-[var(--surface-elevated)] text-[var(--text-main)] focus:outline-none focus:border-[var(--border-accent)] rounded"
              />
            </div>
          </div>
        )}

        {/* Step 2: Points & Importance */}
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

      {/* Buttons Navigation bar */}
      <div className="flex justify-between items-center border-t border-[var(--border-subtle)] pt-6 select-none font-mono">
        <button
          onClick={handleBack}
          disabled={currentStep === 1}
          className={`flex items-center gap-1.5 px-4 py-2 border rounded-md cursor-pointer text-xs font-semibold ${
            currentStep === 1
              ? "border-[var(--border-subtle)] text-[var(--text-muted)] cursor-not-allowed"
              : "border-[var(--border-subtle)] text-[var(--text-main)] hover:border-[var(--border-accent)]"
          }`}
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back
        </button>

        {currentStep < 4 ? (
          <button
            onClick={handleNext}
            className="flex items-center gap-1.5 px-5 py-2 bg-[var(--primary-main)] text-black border border-[var(--primary-main)] hover:bg-blue-600 font-bold rounded-md cursor-pointer text-xs uppercase"
          >
            Next
            <ArrowRight className="h-3.5 w-3.5" />
          </button>
        ) : (
          <button
            onClick={handleSubmit}
            disabled={createMutation.isPending}
            className="flex items-center gap-1.5 px-6 py-2 bg-[var(--primary-main)] text-black border border-[var(--primary-main)] hover:bg-blue-600 font-bold rounded-md cursor-pointer text-xs uppercase tracking-wider"
          >
            {createMutation.isPending ? "Creating..." : "Finish & Save"}
          </button>
        )}
      </div>
    </div>
  );
}
