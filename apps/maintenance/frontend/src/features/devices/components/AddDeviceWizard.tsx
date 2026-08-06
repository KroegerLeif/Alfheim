"use client";

import React, { useState, useEffect } from "react";
import { CreateDevicePayload, CreateStepPayload } from "@/shared/types";
import { CATEGORIES } from "@/shared/data";
import { useLayout } from "@/shared/layout/LayoutContext";
import { X, Loader2, CheckCircle2 } from "lucide-react";
import { cn } from "@/core/utils";
import { useTranslations } from "next-intl";
import { useHouseholds, useCreateDevice } from "../hooks/useDevices";
import { DeviceDetailsForm } from "./DeviceDetailsForm";
import { MaintenanceStepsForm } from "./MaintenanceStepsForm";

interface AddDeviceWizardProps {
  onClose: () => void;
}

const EMPTY_STEP: CreateStepPayload = {
  title: "",
  description: "",
  recurrence: 12,
  supply_item: "",
};

export function AddDeviceWizard({ onClose }: AddDeviceWizardProps) {
  const t = useTranslations("maintenance");
  const { householdId } = useLayout();

  // Fetch households using hook
  const { data: households = [] } = useHouseholds();

  // Device base fields
  const [name, setName] = useState("");
  const [model, setModel] = useState("");
  const [serial, setSerial] = useState("");
  const [category, setCategory] = useState<string>(CATEGORIES[0]);
  const [location, setLocation] = useState("");
  const [deviceStatus, setDeviceStatus] = useState<string>("active");
  const [intervalMonths, setIntervalMonths] = useState<number>(12);
  const [notes, setNotes] = useState("");
  const [selectedHouseholdId, setSelectedHouseholdId] = useState<number>(
    householdId ?? households[0]?.id ?? 1
  );

  // Synchronize selection dynamically once households load or layout changes
  useEffect(() => {
    if (householdId !== null && householdId !== undefined) {
      setSelectedHouseholdId(householdId);
    } else if (households.length > 0) {
      setSelectedHouseholdId(households[0].id);
    }
  }, [householdId, households]);

  // Dynamic steps array — starts with one empty step
  const [steps, setSteps] = useState<CreateStepPayload[]>([{ ...EMPTY_STEP }]);
  const [success, setSuccess] = useState(false);

  // Create device mutation using hook
  const mutation = useCreateDevice(() => {
    setSuccess(true);
    setTimeout(onClose, 1200);
  });

  const handleAddStep = () => {
    setSteps((prev) => [...prev, { ...EMPTY_STEP }]);
  };

  const handleRemoveStep = (idx: number) => {
    setSteps((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleStepChange = <K extends keyof CreateStepPayload>(
    idx: number,
    field: K,
    value: CreateStepPayload[K]
  ) => {
    setSteps((prev) =>
      prev.map((s, i) => (i === idx ? { ...s, [field]: value } : s))
    );
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !model || !serial || !location) return;

    const payload: CreateDevicePayload = {
      name,
      model,
      serial,
      category,
      location,
      status: deviceStatus,
      service_interval_months: intervalMonths,
      notes: notes || null,
      household_id: selectedHouseholdId,
      // Filter out steps with no title
      steps: steps.filter((s) => s.title.trim().length > 0),
    };
    mutation.mutate(payload);
  };

  return (
    // Full-screen backdrop — UPDATED TO z-[9999] per Stacking Context rule
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 font-sans">
      <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto bg-[var(--surface-card)] text-[var(--text-main)] rounded-2xl border border-[var(--border-subtle)] shadow-2xl flex flex-col">

        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-[var(--border-subtle)] sticky top-0 bg-[var(--surface-card)]/90 backdrop-blur-sm rounded-t-2xl z-10">
          <div>
            <h2 className="text-sm font-black uppercase tracking-widest text-[var(--primary-main)]">
              {t("wizard.registerTitle")}
            </h2>
            <p className="text-xs text-[var(--text-muted)] mt-0.5">
              {t("wizard.registerSubtitle")}
            </p>
          </div>
          <button
            onClick={onClose}
            className="h-8 w-8 rounded-lg bg-[var(--surface-canvas)] hover:bg-[var(--surface-elevated)] border border-[var(--border-subtle)] flex items-center justify-center text-[var(--text-muted)] hover:text-[var(--text-main)] transition-all"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          <DeviceDetailsForm
            name={name}
            setName={setName}
            model={model}
            setModel={setModel}
            serial={serial}
            setSerial={setSerial}
            category={category}
            setCategory={setCategory}
            location={location}
            setLocation={setLocation}
            deviceStatus={deviceStatus}
            setDeviceStatus={setDeviceStatus}
            intervalMonths={intervalMonths}
            setIntervalMonths={setIntervalMonths}
            selectedHouseholdId={selectedHouseholdId}
            setSelectedHouseholdId={setSelectedHouseholdId}
            notes={notes}
            setNotes={setNotes}
            households={households}
          />

          <MaintenanceStepsForm
            steps={steps}
            handleAddStep={handleAddStep}
            handleRemoveStep={handleRemoveStep}
            handleStepChange={handleStepChange}
          />

          {/* Error message */}
          {mutation.isError && (
            <p className="text-xs text-red-500 font-mono">
              {t("wizard.errorSave")}
            </p>
          )}

          {/* Submit */}
          <div className="flex justify-end gap-3 pt-2 border-t border-[var(--border-subtle)]">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2 text-xs font-black uppercase tracking-wider text-[var(--text-muted)] hover:text-[var(--text-main)] bg-[var(--surface-canvas)] hover:bg-[var(--surface-elevated)] border border-[var(--border-subtle)] rounded-xl transition-all"
            >
              {t("wizard.cancel")}
            </button>
            <button
              type="submit"
              disabled={mutation.isPending || success}
              className={cn(
                "px-6 py-2 text-xs font-black uppercase tracking-wider rounded-xl border transition-all flex items-center gap-2",
                success
                  ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/30"
                  : mutation.isPending
                  ? "bg-[var(--primary-main)]/10 text-[var(--primary-main)] border-[var(--primary-main)]/20 cursor-wait"
                  : "bg-[var(--primary-main)] text-black border-transparent hover:opacity-90"
              )}
            >
              {success ? (
                <><CheckCircle2 className="h-3.5 w-3.5" /> {t("wizard.saved")}</>
              ) : mutation.isPending ? (
                <><Loader2 className="h-3.5 w-3.5 animate-spin" /> {t("wizard.saving")}</>
              ) : (
                t("wizard.registerDevice")
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
