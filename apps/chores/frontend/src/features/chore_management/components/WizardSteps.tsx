"use client";

import { useState } from "react";
import { useCreateChoreTemplate } from "../services/choresService";
import { useRouter } from "@/navigation";
import { ClipboardList, Award, RefreshCw, UserCheck, ArrowRight, ArrowLeft } from "lucide-react";
import { z } from "zod";
import { WizardStepContent } from "./WizardStepContent";

const choreFormSchema = z.object({
  name: z.string().min(1, "Name is required").max(100, "Name must be less than 100 characters"),
  description: z.string().max(500, "Description must be less than 500 characters").optional(),
  points: z.number().min(1).max(100),
  isNonCumulative: z.boolean(),
});

export function WizardSteps() {
  const router = useRouter();
  const createMutation = useCreateChoreTemplate();
  const [currentStep, setCurrentStep] = useState(1);

  // Form states
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [points, setPoints] = useState(10);
  const [isNonCumulative, setIsNonCumulative] = useState(true);
  const [assignmentType, setAssignmentType] = useState("open");

  // Error feedback states
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitError, setSubmitError] = useState<string | null>(null);

  const handleNext = () => {
    if (currentStep === 1) {
      const result = z.string().min(1, "Name is required").safeParse(name);
      if (!result.success) {
        setErrors({ name: result.error.errors[0].message });
        return;
      }
      setErrors({});
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
    const parseResult = choreFormSchema.safeParse({
      name,
      description: description || undefined,
      points,
      isNonCumulative,
    });

    if (!parseResult.success) {
      const fieldErrors: Record<string, string> = {};
      parseResult.error.errors.forEach((err) => {
        if (err.path[0]) {
          fieldErrors[err.path[0].toString()] = err.message;
        }
      });
      setErrors(fieldErrors);
      setCurrentStep(1); // Return to details step to fix inputs
      return;
    }

    setSubmitError(null);
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
          setSubmitError(`Failed to create chore template: ${err.message}`);
        },
      }
    );
  };

  return (
    <div className="bg-[var(--surface-card)] border border-[var(--border-subtle)] max-w-xl mx-auto p-6 md:p-8 rounded-lg">
      {/* Submit Error Banner */}
      {submitError && (
        <div className="mb-6 p-4 border border-red-800 bg-red-950/20 text-red-400 rounded text-xs font-mono select-none">
          {submitError}
        </div>
      )}

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

      {/* Steps Content rendering via subcomponent */}
      <WizardStepContent
        currentStep={currentStep}
        name={name}
        setName={(val) => { setName(val); if (errors.name) setErrors({}); }}
        description={description}
        setDescription={(val) => { setDescription(val); if (errors.description) setErrors({}); }}
        points={points}
        setPoints={setPoints}
        isNonCumulative={isNonCumulative}
        setIsNonCumulative={setIsNonCumulative}
        assignmentType={assignmentType}
        setAssignmentType={setAssignmentType}
        errors={errors}
      />

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
