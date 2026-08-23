"use client";

import React, { useState, useEffect } from "react";
import { Device, MaintenanceSubmitPayload } from "@/shared/types";
import { ArrowLeft, ArrowRight, Check, Loader2 } from "lucide-react";
import { cn } from "@/core/utils";
import { useAuth } from "@/core/auth/AuthContext";
import { useTranslations } from "next-intl";
import { useSubmitMaintenance } from "../hooks/useMaintenance";
import { ManualsPanel } from "./ManualsPanel";
import { WizardStepContent } from "./WizardStepContent";
import { SuppliesPanel } from "./SuppliesPanel";
import { MaintenanceNavBar } from "./MaintenanceNavBar";
import { NoStepsView } from "./NoStepsView";

interface MaintenanceModeProps {
  device: Device;
  onClose: () => void;
}

export function MaintenanceMode({ device, onClose }: MaintenanceModeProps) {
  const t = useTranslations("maintenance");
  const { user } = useAuth();
  const steps = device.steps ?? [];
  const totalSteps = steps.length;

  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [doneSteps, setDoneSteps] = useState<Set<number>>(new Set());
  const [stepNotes, setStepNotes] = useState<Record<number, string>>({});
  const [cart, setCart] = useState<string[]>([]);

  const activeStep = steps[currentStepIndex];

  useEffect(() => {
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem("cart_maintenance-frontend");
      if (stored) {
        try { setCart(JSON.parse(stored)); } catch {}
      }
    }
  }, []);

  const updateCart = (newCart: string[]) => {
    setCart(newCart);
    if (typeof window !== "undefined") {
      localStorage.setItem("cart_maintenance-frontend", JSON.stringify(newCart));
    }
  };

  const submissionMutation = useSubmitMaintenance(() => {
    updateCart([]);
    onClose();
  });

  if (totalSteps === 0) {
    return (
      <NoStepsView
        noStepsTitle={t("wizardMode.noStepsDefined")}
        noStepsDesc={t("wizardMode.noStepsDesc")}
        closeText={t("wizardMode.close")}
        onClose={onClose}
      />
    );
  }

  const currentSupplyItem = activeStep?.supply_item ?? null;
  const isPartInCart = currentSupplyItem ? cart.includes(currentSupplyItem) : false;

  const toggleCartPart = () => {
    if (!currentSupplyItem) return;
    updateCart(isPartInCart ? cart.filter((i) => i !== currentSupplyItem) : [...cart, currentSupplyItem]);
  };

  const handleToggleStepDone = (stepId: number) => {
    const newDone = new Set(doneSteps);
    if (newDone.has(stepId)) newDone.delete(stepId);
    else newDone.add(stepId);
    setDoneSteps(newDone);
  };

  const handleNext = () => {
    if (currentStepIndex < totalSteps - 1) setCurrentStepIndex(currentStepIndex + 1);
  };

  const handlePrev = () => {
    if (currentStepIndex > 0) setCurrentStepIndex(currentStepIndex - 1);
  };

  const handleNoteChange = (text: string) => {
    if (!activeStep) return;
    setStepNotes({ ...stepNotes, [activeStep.id]: text });
  };

  const progressPercentage = Math.round((doneSteps.size / totalSteps) * 100);
  const isWizardComplete = doneSteps.size === totalSteps;

  const handleFinishWizard = () => {
    const completedStepIds = Array.from(doneSteps);
    const notesArray = Object.entries(stepNotes)
      .map(([id, note]) => {
        const stepTitle = steps.find((s) => s.id === Number(id))?.title || "Step";
        return `${stepTitle}: ${note}`;
      })
      .filter(Boolean);

    const payload: MaintenanceSubmitPayload = {
      device_id: device.id,
      completed_step_ids: completedStepIds,
      step_notes: notesArray.join("\n") || "All service steps inspected and completed.",
      performer: user?.name || "Authenticated User",
      supply_items: cart.length > 0 ? cart : null,
    };

    submissionMutation.mutate(payload);
  };

  return (
    <div className="fixed inset-0 z-[9999] flex flex-col bg-[var(--surface-canvas)] backdrop-blur-md font-sans text-[var(--text-main)]">
      <MaintenanceNavBar
        deviceName={device.name}
        progressPercentage={progressPercentage}
        onClose={onClose}
        isPending={submissionMutation.isPending}
      />

      <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 overflow-hidden">
        <ManualsPanel />

        <div className="col-span-1 lg:col-span-6 flex flex-col justify-between p-6 md:p-8 overflow-y-auto bg-[var(--surface-canvas)]">
          <WizardStepContent
            activeStep={activeStep}
            currentStepIndex={currentStepIndex}
            totalSteps={totalSteps}
            doneSteps={doneSteps}
            stepNotes={stepNotes}
            handleToggleStepDone={handleToggleStepDone}
            handleNoteChange={handleNoteChange}
            isPending={submissionMutation.isPending}
          />

          <div className="flex items-center justify-between gap-4 pt-8 mt-auto">
            <button
              onClick={handlePrev}
              disabled={currentStepIndex === 0 || submissionMutation.isPending}
              className={cn(
                "px-4 py-2.5 rounded-xl border text-xs font-black uppercase tracking-wider transition-all flex items-center gap-2 cursor-pointer",
                currentStepIndex === 0
                  ? "border-[var(--border-subtle)] text-[var(--text-muted)]/40 cursor-not-allowed"
                  : "border-[var(--border-subtle)] text-[var(--text-muted)] hover:bg-[var(--surface-elevated)] hover:text-[var(--text-main)]"
              )}
            >
              <ArrowLeft className="h-4 w-4" />
              {t("wizardMode.back")}
            </button>

            {currentStepIndex === totalSteps - 1 ? (
              <button
                onClick={handleFinishWizard}
                disabled={!isWizardComplete || submissionMutation.isPending}
                className={cn(
                  "px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center gap-2 cursor-pointer shadow-lg",
                  isWizardComplete && !submissionMutation.isPending
                    ? "bg-emerald-500 text-black hover:bg-emerald-600 shadow-emerald-500/10"
                    : "bg-[var(--surface-elevated)] border border-[var(--border-subtle)] text-[var(--text-muted)] cursor-not-allowed"
                )}
              >
                {submissionMutation.isPending ? (
                  <><Loader2 className="h-4 w-4 animate-spin" /> {t("wizardMode.saving")}</>
                ) : (
                  <><Check className="h-4 w-4 stroke-[3]" /> {t("wizardMode.finishAndSave")}</>
                )}
              </button>
            ) : (
              <button
                onClick={handleNext}
                disabled={submissionMutation.isPending}
                className="px-5 py-2.5 rounded-xl bg-[var(--primary-main)] hover:opacity-90 text-black text-xs font-black uppercase tracking-wider transition-all flex items-center gap-2 cursor-pointer shadow-lg shadow-[var(--primary-main)]/10"
              >
                {t("wizardMode.next")}
                <ArrowRight className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>

        <SuppliesPanel
          currentSupplyItem={currentSupplyItem}
          isPartInCart={isPartInCart}
          toggleCartPart={toggleCartPart}
          isPending={submissionMutation.isPending}
        />
      </div>
    </div>
  );
}
