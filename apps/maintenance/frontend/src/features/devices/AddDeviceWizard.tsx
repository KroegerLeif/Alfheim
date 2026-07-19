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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto glass-card rounded-2xl border border-white/10 shadow-2xl flex flex-col">

        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-white/5 sticky top-0 bg-slate-900/80 backdrop-blur-sm rounded-t-2xl z-10">
          <div>
            <h2 className="text-sm font-black uppercase tracking-widest text-cyan-400">
              Register New Device
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Create a device and define its initial maintenance schedule.
            </p>
          </div>
          <button
            onClick={onClose}
            className="h-8 w-8 rounded-lg bg-white/5 hover:bg-white/10 border border-white/5 flex items-center justify-center text-slate-400 hover:text-white transition-all"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-6">

          {/* Section: Device Details */}
          <fieldset className="space-y-4">
            <legend className="text-[9px] font-black uppercase tracking-widest text-slate-500 mb-3">
              Device Details
            </legend>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <label className="space-y-1.5">
                <span className="text-[9px] font-black uppercase tracking-wider text-slate-500">Name *</span>
                <input
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Heat Pump Daikin"
                  className="w-full p-2.5 bg-white/5 border border-white/5 focus:border-cyan-500/40 rounded-xl text-slate-200 text-sm focus:outline-none transition-all placeholder:text-slate-600 font-mono"
                />
              </label>
              <label className="space-y-1.5">
                <span className="text-[9px] font-black uppercase tracking-wider text-slate-500">Model *</span>
                <input
                  required
                  value={model}
                  onChange={(e) => setModel(e.target.value)}
                  placeholder="e.g. EHVH08S23EJ6V"
                  className="w-full p-2.5 bg-white/5 border border-white/5 focus:border-cyan-500/40 rounded-xl text-slate-200 text-sm focus:outline-none transition-all placeholder:text-slate-600 font-mono"
                />
              </label>
              <label className="space-y-1.5">
                <span className="text-[9px] font-black uppercase tracking-wider text-slate-500">Serial No. *</span>
                <input
                  required
                  value={serial}
                  onChange={(e) => setSerial(e.target.value)}
                  placeholder="e.g. DK-90812903-HP"
                  className="w-full p-2.5 bg-white/5 border border-white/5 focus:border-cyan-500/40 rounded-xl text-slate-200 text-sm focus:outline-none transition-all placeholder:text-slate-600 font-mono"
                />
              </label>
              <label className="space-y-1.5">
                <span className="text-[9px] font-black uppercase tracking-wider text-slate-500">Location *</span>
                <input
                  required
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  placeholder="e.g. Basement / Utility Room"
                  className="w-full p-2.5 bg-white/5 border border-white/5 focus:border-cyan-500/40 rounded-xl text-slate-200 text-sm focus:outline-none transition-all placeholder:text-slate-600 font-mono"
                />
              </label>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {/* Category */}
              <label className="space-y-1.5">
                <span className="text-[9px] font-black uppercase tracking-wider text-slate-500">Category</span>
                <div className="relative">
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="w-full appearance-none p-2.5 bg-white/5 border border-white/5 focus:border-cyan-500/40 rounded-xl text-slate-200 text-sm focus:outline-none transition-all pr-8"
                  >
                    {CATEGORIES.map((c) => (
                      <option key={c} value={c} className="bg-slate-900">{c}</option>
                    ))}
                  </select>
                  <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-500 pointer-events-none" />
                </div>
              </label>

              {/* Status */}
              <label className="space-y-1.5">
                <span className="text-[9px] font-black uppercase tracking-wider text-slate-500">Status</span>
                <div className="relative">
                  <select
                    value={deviceStatus}
                    onChange={(e) => setDeviceStatus(e.target.value)}
                    className="w-full appearance-none p-2.5 bg-white/5 border border-white/5 focus:border-cyan-500/40 rounded-xl text-slate-200 text-sm focus:outline-none transition-all pr-8"
                  >
                    {STATUSES.map((s) => (
                      <option key={s} value={s} className="bg-slate-900 capitalize">{s}</option>
                    ))}
                  </select>
                  <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-500 pointer-events-none" />
                </div>
              </label>

              {/* Service interval */}
              <label className="space-y-1.5">
                <span className="text-[9px] font-black uppercase tracking-wider text-slate-500">
                  Interval (months)
                </span>
                <input
                  type="number"
                  min={1}
                  max={120}
                  value={intervalMonths}
                  onChange={(e) => setIntervalMonths(Number(e.target.value))}
                  className="w-full p-2.5 bg-white/5 border border-white/5 focus:border-cyan-500/40 rounded-xl text-slate-200 text-sm focus:outline-none transition-all font-mono"
                />
              </label>
            </div>

            {/* Household */}
            <label className="space-y-1.5 block">
              <span className="text-[9px] font-black uppercase tracking-wider text-slate-500">Household</span>
              <div className="relative">
                <select
                  value={selectedHouseholdId}
                  onChange={(e) => setSelectedHouseholdId(Number(e.target.value))}
                  className="w-full appearance-none p-2.5 bg-white/5 border border-white/5 focus:border-cyan-500/40 rounded-xl text-slate-200 text-sm focus:outline-none transition-all pr-8"
                >
                  {households.map((h) => (
                    <option key={h.id} value={h.id} className="bg-slate-900">{h.name}</option>
                  ))}
                </select>
                <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-500 pointer-events-none" />
              </div>
            </label>

            {/* Notes */}
            <label className="space-y-1.5 block">
              <span className="text-[9px] font-black uppercase tracking-wider text-slate-500">Notes</span>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
                placeholder="Optional notes about this device..."
                className="w-full p-2.5 bg-white/5 border border-white/5 focus:border-cyan-500/40 rounded-xl text-slate-200 text-sm focus:outline-none resize-none transition-all placeholder:text-slate-600 font-mono"
              />
            </label>
          </fieldset>

          {/* Section: Maintenance Steps */}
          <fieldset className="space-y-3">
            <div className="flex items-center justify-between">
              <legend className="text-[9px] font-black uppercase tracking-widest text-slate-500">
                Maintenance Steps
              </legend>
              <button
                type="button"
                onClick={handleAddStep}
                className="flex items-center gap-1.5 text-[9px] font-black uppercase tracking-wider text-cyan-400 hover:text-cyan-300 transition-colors px-2.5 py-1 rounded-lg bg-cyan-500/10 border border-cyan-500/20 hover:bg-cyan-500/20"
              >
                <Plus className="h-3 w-3" />
                Add Step
              </button>
            </div>

            {steps.map((step, idx) => (
              <div
                key={idx}
                className="p-4 bg-white/5 rounded-xl border border-white/5 space-y-3"
              >
                <div className="flex items-center justify-between">
                  <span className="text-[9px] font-black uppercase tracking-wider text-slate-500">
                    Step {idx + 1}
                  </span>
                  {steps.length > 1 && (
                    <button
                      type="button"
                      onClick={() => handleRemoveStep(idx)}
                      className="h-6 w-6 rounded-lg bg-red-500/10 border border-red-500/20 flex items-center justify-center text-red-400 hover:bg-red-500/20 transition-all"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <label className="space-y-1 block">
                    <span className="text-[9px] font-bold uppercase tracking-wider text-slate-600">Title *</span>
                    <input
                      value={step.title}
                      onChange={(e) => handleStepChange(idx, "title", e.target.value)}
                      placeholder="e.g. Replace Air Filter"
                      className="w-full p-2 bg-black/20 border border-white/5 focus:border-cyan-500/30 rounded-lg text-slate-200 text-xs focus:outline-none transition-all placeholder:text-slate-700 font-mono"
                    />
                  </label>
                  <label className="space-y-1 block">
                    <span className="text-[9px] font-bold uppercase tracking-wider text-slate-600">Supply Item</span>
                    <input
                      value={step.supply_item ?? ""}
                      onChange={(e) => handleStepChange(idx, "supply_item", e.target.value || null)}
                      placeholder="e.g. HEPA Filter F7"
                      className="w-full p-2 bg-black/20 border border-white/5 focus:border-cyan-500/30 rounded-lg text-slate-200 text-xs focus:outline-none transition-all placeholder:text-slate-700 font-mono"
                    />
                  </label>
                  <label className="space-y-1 block">
                    <span className="text-[9px] font-bold uppercase tracking-wider text-slate-600">Recurrence (months)</span>
                    <input
                      type="number"
                      min={1}
                      max={120}
                      value={step.recurrence}
                      onChange={(e) => handleStepChange(idx, "recurrence", Number(e.target.value))}
                      className="w-full p-2 bg-black/20 border border-white/5 focus:border-cyan-500/30 rounded-lg text-slate-200 text-xs focus:outline-none transition-all font-mono"
                    />
                  </label>
                  <label className="space-y-1 block sm:col-span-2">
                    <span className="text-[9px] font-bold uppercase tracking-wider text-slate-600">Procedure Description</span>
                    <input
                      value={step.description ?? ""}
                      onChange={(e) => handleStepChange(idx, "description", e.target.value || null)}
                      placeholder="Short description of what to do..."
                      className="w-full p-2 bg-black/20 border border-white/5 focus:border-cyan-500/30 rounded-lg text-slate-200 text-xs focus:outline-none transition-all placeholder:text-slate-700 font-mono"
                    />
                  </label>
                </div>
              </div>
            ))}
          </fieldset>

          {/* Error message */}
          {mutation.isError && (
            <p className="text-xs text-red-400 font-mono">
              Error saving device. Please check the form and try again.
            </p>
          )}

          {/* Submit */}
          <div className="flex justify-end gap-3 pt-2 border-t border-white/5">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2 text-xs font-black uppercase tracking-wider text-slate-400 hover:text-white bg-white/5 hover:bg-white/10 border border-white/5 rounded-xl transition-all"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={mutation.isPending || success}
              className={cn(
                "px-6 py-2 text-xs font-black uppercase tracking-wider rounded-xl border transition-all flex items-center gap-2",
                success
                  ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/30"
                  : mutation.isPending
                  ? "bg-cyan-500/10 text-cyan-400 border-cyan-500/20 cursor-wait"
                  : "bg-cyan-500 text-slate-950 border-transparent hover:bg-cyan-400"
              )}
            >
              {success ? (
                <><CheckCircle2 className="h-3.5 w-3.5" /> Saved!</>
              ) : mutation.isPending ? (
                <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Saving...</>
              ) : (
                "Register Device"
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
