"use client";

import React, { useState } from "react";
import { Device, MaintenanceSubmitPayload } from "@/shared/types";
import { useAuth } from "@alfheim/shared";
import { useTranslations } from "next-intl";
import { useCart } from "@/features/shopping";
import { useSubmitMaintenance } from "../hooks/useMaintenance";
import { WizardStepContent } from "./WizardStepContent";
import { SuppliesPanel } from "./SuppliesPanel";
import { MaintenanceNavBar } from "./MaintenanceNavBar";
import { NoStepsView } from "./NoStepsView";
import { WizardFooter } from "./WizardFooter";

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
  const { cart, toggle: toggleCart, clear: clearCart } = useCart();

  const activeStep = steps[currentStepIndex];

  const submissionMutation = useSubmitMaintenance(() => {
    clearCart();
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

  const handleToggleStepDone = (stepId: number) => {
    const newDone = new Set(doneSteps);
    if (newDone.has(stepId)) newDone.delete(stepId);
    else newDone.add(stepId);
    setDoneSteps(newDone);
  };

  const handleNoteChange = (text: string) => {
    if (!activeStep) return;
    setStepNotes({ ...stepNotes, [activeStep.id]: text });
  };

  const progressPercentage = Math.round((doneSteps.size / totalSteps) * 100);
  const isWizardComplete = doneSteps.size === totalSteps;

  const handleFinishWizard = () => {
    const notes = Object.entries(stepNotes)
      .filter(([, note]) => note.trim().length > 0)
      .map(([id, note]) => {
        const stepTitle = steps.find((s) => s.id === Number(id))?.title || t("wizardMode.stepFallback");
        return `${stepTitle}: ${note.trim()}`;
      });

    const payload: MaintenanceSubmitPayload = {
      device_id: device.id,
      completed_step_ids: Array.from(doneSteps),
      step_notes: notes.join("\n") || t("wizardMode.defaultNotes"),
      performer: user?.name || t("wizardMode.performerFallback"),
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

      <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-12 overflow-y-auto lg:overflow-hidden">
        <div className="col-span-1 lg:col-span-9 flex flex-col justify-between p-6 md:p-8 lg:overflow-y-auto bg-[var(--surface-canvas)]">
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

          {submissionMutation.isError && (
            <p role="alert" className="mt-6 border border-rose-800/40 bg-rose-950/20 text-rose-400 p-3 text-xs font-semibold rounded-lg">
              {t("wizardMode.submitFailed")}
            </p>
          )}

          <WizardFooter
            currentStepIndex={currentStepIndex}
            totalSteps={totalSteps}
            isWizardComplete={isWizardComplete}
            isPending={submissionMutation.isPending}
            onPrev={() => setCurrentStepIndex((index) => Math.max(0, index - 1))}
            onNext={() => setCurrentStepIndex((index) => Math.min(totalSteps - 1, index + 1))}
            onFinish={handleFinishWizard}
          />
        </div>

        <SuppliesPanel
          currentSupplyItem={currentSupplyItem}
          isPartInCart={isPartInCart}
          toggleCartPart={() => currentSupplyItem && toggleCart(currentSupplyItem)}
          isPending={submissionMutation.isPending}
        />
      </div>
    </div>
  );
}
