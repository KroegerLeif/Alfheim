"use client";

import React, { useState } from "react";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { createDevice, getHouseholds } from "@/shared/api";
import { CreateDevicePayload, CreateStepPayload } from "@/shared/types";
import { CATEGORIES } from "@/shared/data";
import { useLayout } from "@/shared/layout/LayoutContext";
import {
  X,
  Plus,
  Trash2,
  Loader2,
  CheckCircle2,
  ChevronDown,
} from "lucide-react";
import { cn } from "@/shared/utils";
import { useTranslations } from "next-intl";

interface AddDeviceWizardProps {
  onClose: () => void;
}

const STATUSES = ["active", "maintenance", "inactive"] as const;

const EMPTY_STEP: CreateStepPayload = {
  title: "",
  description: "",
  recurrence: 12,
  supply_item: "",
};

export function AddDeviceWizard({ onClose }: AddDeviceWizardProps) {
  const t = useTranslations("maintenance");
  const queryClient = useQueryClient();
  const { householdId } = useLayout();

  // Fetch households to populate the selector
  const { data: households = [] } = useQuery({
    queryKey: ["households"],
    queryFn: getHouseholds,
  });

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

  // Dynamic steps array — starts with one empty step
  const [steps, setSteps] = useState<CreateStepPayload[]>([{ ...EMPTY_STEP }]);

  const [success, setSuccess] = useState(false);

  const mutation = useMutation({
    mutationFn: (payload: CreateDevicePayload) => createDevice(payload),
    onSuccess: () => {
      // Invalidate the device list so DevicesView and MaintenanceView refresh
      queryClient.invalidateQueries({ queryKey: ["devices"] });
      setSuccess(true);
      setTimeout(onClose, 1200);
    },
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
    // Full-screen backdrop
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 font-sans">
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

          {/* Section: Device Details */}
          <fieldset className="space-y-4">
            <legend className="text-[9px] font-black uppercase tracking-widest text-[var(--text-muted)] mb-3">
              {t("wizard.deviceDetailsLegend")}
            </legend>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <label className="space-y-1.5">
                <span className="text-[9px] font-black uppercase tracking-wider text-[var(--text-muted)]">
                  {t("wizard.name")}
                </span>
                <input
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder={t("wizard.namePlaceholder")}
                  className="w-full p-2.5 bg-[var(--surface-canvas)] border border-[var(--border-subtle)] focus:border-[var(--primary-main)]/50 rounded-xl text-[var(--text-main)] text-sm focus:outline-none transition-all placeholder:text-[var(--text-muted)]/50 font-mono"
                />
              </label>
              <label className="space-y-1.5">
                <span className="text-[9px] font-black uppercase tracking-wider text-[var(--text-muted)]">
                  {t("deviceInventory.fields.model")} *
                </span>
                <input
                  required
                  value={model}
                  onChange={(e) => setModel(e.target.value)}
                  placeholder={t("wizard.modelPlaceholder")}
                  className="w-full p-2.5 bg-[var(--surface-canvas)] border border-[var(--border-subtle)] focus:border-[var(--primary-main)]/50 rounded-xl text-[var(--text-main)] text-sm focus:outline-none transition-all placeholder:text-[var(--text-muted)]/50 font-mono"
                />
              </label>
              <label className="space-y-1.5">
                <span className="text-[9px] font-black uppercase tracking-wider text-[var(--text-muted)]">
                  {t("deviceInventory.fields.serialKey")} *
                </span>
                <input
                  required
                  value={serial}
                  onChange={(e) => setSerial(e.target.value)}
                  placeholder={t("wizard.serialPlaceholder")}
                  className="w-full p-2.5 bg-[var(--surface-canvas)] border border-[var(--border-subtle)] focus:border-[var(--primary-main)]/50 rounded-xl text-[var(--text-main)] text-sm focus:outline-none transition-all placeholder:text-[var(--text-muted)]/50 font-mono"
                />
              </label>
              <label className="space-y-1.5">
                <span className="text-[9px] font-black uppercase tracking-wider text-[var(--text-muted)]">
                  {t("deviceInventory.fields.location")} *
                </span>
                <input
                  required
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  placeholder={t("wizard.locationPlaceholder")}
                  className="w-full p-2.5 bg-[var(--surface-canvas)] border border-[var(--border-subtle)] focus:border-[var(--primary-main)]/50 rounded-xl text-[var(--text-main)] text-sm focus:outline-none transition-all placeholder:text-[var(--text-muted)]/50 font-mono"
                />
              </label>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {/* Category */}
              <label className="space-y-1.5">
                <span className="text-[9px] font-black uppercase tracking-wider text-[var(--text-muted)]">
                  {t("wizard.category")}
                </span>
                <div className="relative">
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="w-full appearance-none p-2.5 bg-[var(--surface-canvas)] border border-[var(--border-subtle)] focus:border-[var(--primary-main)]/50 rounded-xl text-[var(--text-main)] text-sm focus:outline-none transition-all pr-8"
                  >
                    {CATEGORIES.map((c) => (
                      <option key={c} value={c} className="bg-[var(--surface-card)] text-[var(--text-main)]">{c}</option>
                    ))}
                  </select>
                  <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[var(--text-muted)] pointer-events-none" />
                </div>
              </label>

              {/* Status */}
              <label className="space-y-1.5">
                <span className="text-[9px] font-black uppercase tracking-wider text-[var(--text-muted)]">
                  {t("wizard.status")}
                </span>
                <div className="relative">
                  <select
                    value={deviceStatus}
                    onChange={(e) => setDeviceStatus(e.target.value)}
                    className="w-full appearance-none p-2.5 bg-[var(--surface-canvas)] border border-[var(--border-subtle)] focus:border-[var(--primary-main)]/50 rounded-xl text-[var(--text-main)] text-sm focus:outline-none transition-all pr-8"
                  >
                    {STATUSES.map((s) => (
                      <option key={s} value={s} className="bg-[var(--surface-card)] text-[var(--text-main)] capitalize">{s}</option>
                    ))}
                  </select>
                  <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[var(--text-muted)] pointer-events-none" />
                </div>
              </label>

              {/* Service interval */}
              <label className="space-y-1.5">
                <span className="text-[9px] font-black uppercase tracking-wider text-[var(--text-muted)]">
                  {t("wizard.interval")}
                </span>
                <input
                  type="number"
                  min={1}
                  max={120}
                  value={intervalMonths}
                  onChange={(e) => setIntervalMonths(Number(e.target.value))}
                  className="w-full p-2.5 bg-[var(--surface-canvas)] border border-[var(--border-subtle)] focus:border-[var(--primary-main)]/50 rounded-xl text-[var(--text-main)] text-sm focus:outline-none transition-all font-mono"
                />
              </label>
            </div>

            {/* Household */}
            <label className="space-y-1.5 block">
              <span className="text-[9px] font-black uppercase tracking-wider text-[var(--text-muted)]">
                {t("wizard.household")}
              </span>
              <div className="relative">
                <select
                  value={selectedHouseholdId}
                  onChange={(e) => setSelectedHouseholdId(Number(e.target.value))}
                  className="w-full appearance-none p-2.5 bg-[var(--surface-canvas)] border border-[var(--border-subtle)] focus:border-[var(--primary-main)]/50 rounded-xl text-[var(--text-main)] text-sm focus:outline-none transition-all pr-8"
                >
                  {households.map((h) => (
                    <option key={h.id} value={h.id} className="bg-[var(--surface-card)] text-[var(--text-main)]">{h.name}</option>
                  ))}
                </select>
                <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[var(--text-muted)] pointer-events-none" />
              </div>
            </label>

            {/* Notes */}
            <label className="space-y-1.5 block">
              <span className="text-[9px] font-black uppercase tracking-wider text-[var(--text-muted)]">
                {t("wizard.notes")}
              </span>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
                placeholder={t("wizard.notesPlaceholder")}
                className="w-full p-2.5 bg-[var(--surface-canvas)] border border-[var(--border-subtle)] focus:border-[var(--primary-main)]/50 rounded-xl text-[var(--text-main)] text-sm focus:outline-none resize-none transition-all placeholder:text-[var(--text-muted)]/50 font-mono"
              />
            </label>
          </fieldset>

          {/* Section: Maintenance Steps */}
          <fieldset className="space-y-3">
            <div className="flex items-center justify-between">
              <legend className="text-[9px] font-black uppercase tracking-widest text-[var(--text-muted)]">
                {t("wizard.stepsLegend")}
              </legend>
              <button
                type="button"
                onClick={handleAddStep}
                className="flex items-center gap-1.5 text-[9px] font-black uppercase tracking-wider text-[var(--primary-main)] hover:opacity-80 transition-colors px-2.5 py-1 rounded-lg bg-[var(--primary-main)]/10 border border-[var(--primary-main)]/20"
              >
                <Plus className="h-3 w-3" />
                {t("wizard.addStep")}
              </button>
            </div>

            {steps.map((step, idx) => (
              <div
                key={idx}
                className="p-4 bg-[var(--surface-canvas)] rounded-xl border border-[var(--border-subtle)] space-y-3"
              >
                <div className="flex items-center justify-between">
                  <span className="text-[9px] font-black uppercase tracking-wider text-[var(--text-muted)]">
                    {t("wizard.stepNumber", { number: idx + 1 })}
                  </span>
                  {steps.length > 1 && (
                    <button
                      type="button"
                      onClick={() => handleRemoveStep(idx)}
                      className="h-6 w-6 rounded-lg bg-red-500/10 border border-red-500/20 flex items-center justify-center text-red-500 hover:bg-red-500/20 transition-all"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <label className="space-y-1 block">
                    <span className="text-[9px] font-bold uppercase tracking-wider text-[var(--text-muted)]">
                      {t("wizard.title")}
                    </span>
                    <input
                      value={step.title}
                      onChange={(e) => handleStepChange(idx, "title", e.target.value)}
                      placeholder={t("wizard.titlePlaceholder")}
                      className="w-full p-2 bg-[var(--surface-card)] border border-[var(--border-subtle)] focus:border-[var(--primary-main)]/30 rounded-lg text-[var(--text-main)] text-xs focus:outline-none transition-all placeholder:text-[var(--text-muted)]/50 font-mono"
                    />
                  </label>
                  <label className="space-y-1 block">
                    <span className="text-[9px] font-bold uppercase tracking-wider text-[var(--text-muted)]">
                      {t("wizard.supplyItem")}
                    </span>
                    <input
                      value={step.supply_item ?? ""}
                      onChange={(e) => handleStepChange(idx, "supply_item", e.target.value || null)}
                      placeholder={t("wizard.supplyPlaceholder")}
                      className="w-full p-2 bg-[var(--surface-card)] border border-[var(--border-subtle)] focus:border-[var(--primary-main)]/30 rounded-lg text-[var(--text-main)] text-xs focus:outline-none transition-all placeholder:text-[var(--text-muted)]/50 font-mono"
                    />
                  </label>
                  <label className="space-y-1 block">
                    <span className="text-[9px] font-bold uppercase tracking-wider text-[var(--text-muted)]">
                      {t("wizard.recurrence")}
                    </span>
                    <input
                      type="number"
                      min={1}
                      max={120}
                      value={step.recurrence}
                      onChange={(e) => handleStepChange(idx, "recurrence", Number(e.target.value))}
                      className="w-full p-2 bg-[var(--surface-card)] border border-[var(--border-subtle)] focus:border-[var(--primary-main)]/30 rounded-lg text-[var(--text-main)] text-xs focus:outline-none transition-all font-mono"
                    />
                  </label>
                  <label className="space-y-1 block sm:col-span-2">
                    <span className="text-[9px] font-bold uppercase tracking-wider text-[var(--text-muted)]">
                      {t("wizard.description")}
                    </span>
                    <input
                      value={step.description ?? ""}
                      onChange={(e) => handleStepChange(idx, "description", e.target.value || null)}
                      placeholder={t("wizard.descriptionPlaceholder")}
                      className="w-full p-2 bg-[var(--surface-card)] border border-[var(--border-subtle)] focus:border-[var(--primary-main)]/30 rounded-lg text-[var(--text-main)] text-xs focus:outline-none transition-all placeholder:text-[var(--text-muted)]/50 font-mono"
                    />
                  </label>
                </div>
              </div>
            ))}
          </fieldset>

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
