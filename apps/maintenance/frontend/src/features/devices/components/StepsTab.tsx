"use client";

import React, { useState } from "react";
import { useTranslations } from "next-intl";
import { Pencil, Plus } from "lucide-react";
import { useHouseholdCan } from "@alfheim/shared";
import { Device } from "@/shared/types";
import { useDeviceEditing } from "../hooks/useDeviceEditing";
import { ConfirmDelete } from "./ConfirmDelete";
import { StepCard } from "./StepCard";
import { StepForm } from "./StepForm";

interface StepsTabProps {
  device: Device;
}

/** The maintenance steps of a device; writers can add, edit and delete them (#505). */
export function StepsTab({ device }: StepsTabProps) {
  const t = useTranslations("maintenance");
  const canWrite = useHouseholdCan("write");
  const { addStep, updateStep, deleteStep } = useDeviceEditing(device.id);
  const [isAdding, setIsAdding] = useState(false);
  const [editingStepId, setEditingStepId] = useState<number | null>(null);
  const steps = device.steps ?? [];

  return (
    <div className="space-y-4">
      {steps.length === 0 && !isAdding && (
        <p className="text-sm text-[var(--text-muted)] text-center py-8">{t("deviceInventory.fields.noSteps")}</p>
      )}

      {steps.map((step) =>
        editingStepId === step.id ? (
          <StepForm
            key={step.id}
            step={step}
            isPending={updateStep.isPending}
            isError={updateStep.isError}
            onCancel={() => setEditingStepId(null)}
            onSubmit={(payload) =>
              updateStep.mutate({ stepId: step.id, payload }, { onSuccess: () => setEditingStepId(null) })
            }
          />
        ) : (
          <StepCard
            key={step.id}
            step={step}
            actions={
              canWrite && (
                <>
                  <button
                    type="button"
                    aria-label={`${t("deviceInventory.edit.editStep")}: ${step.title}`}
                    title={t("deviceInventory.edit.editStep")}
                    onClick={() => setEditingStepId(step.id)}
                    className="inline-flex items-center px-3 py-2 rounded-xl border border-[var(--border-subtle)] text-[var(--text-main)] hover:border-[var(--primary-main)]/50 cursor-pointer"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                  <ConfirmDelete
                    iconOnly
                    label={`${t("deviceInventory.edit.deleteStep")}: ${step.title}`}
                    question={t("deviceInventory.edit.deleteStepQuestion", { title: step.title })}
                    isPending={deleteStep.isPending}
                    onConfirm={() => deleteStep.mutate(step.id)}
                  />
                </>
              )
            }
          />
        )
      )}

      {deleteStep.isError && (
        <p role="alert" className="text-xs text-red-500">
          {t("deviceInventory.edit.deleteError")}
        </p>
      )}

      {canWrite &&
        (isAdding ? (
          <StepForm
            isPending={addStep.isPending}
            isError={addStep.isError}
            onCancel={() => setIsAdding(false)}
            onSubmit={(payload) => addStep.mutate(payload, { onSuccess: () => setIsAdding(false) })}
          />
        ) : (
          <button
            type="button"
            onClick={() => setIsAdding(true)}
            className="w-full inline-flex items-center justify-center gap-1.5 py-2.5 rounded-xl border border-dashed border-[var(--border-subtle)] text-xs font-bold uppercase tracking-wider text-[var(--text-muted)] hover:text-[var(--text-main)] hover:border-[var(--primary-main)]/50 cursor-pointer"
          >
            <Plus className="h-3.5 w-3.5" />
            {t("wizard.addStep")}
          </button>
        ))}
    </div>
  );
}
