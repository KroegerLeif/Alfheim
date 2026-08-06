"use client";

import React from "react";
import { useTranslations } from "next-intl";
import { CATEGORIES } from "@/shared/data";
import { ChevronDown } from "lucide-react";
import { Household } from "@/shared/types";

const STATUSES = ["active", "maintenance", "inactive"] as const;

interface DeviceDetailsFormProps {
  name: string;
  setName: (v: string) => void;
  model: string;
  setModel: (v: string) => void;
  serial: string;
  setSerial: (v: string) => void;
  category: string;
  setCategory: (v: string) => void;
  location: string;
  setLocation: (v: string) => void;
  deviceStatus: string;
  setDeviceStatus: (v: string) => void;
  intervalMonths: number;
  setIntervalMonths: (v: number) => void;
  selectedHouseholdId: number;
  setSelectedHouseholdId: (v: number) => void;
  notes: string;
  setNotes: (v: string) => void;
  households: Household[];
}

export function DeviceDetailsForm({
  name,
  setName,
  model,
  setModel,
  serial,
  setSerial,
  category,
  setCategory,
  location,
  setLocation,
  deviceStatus,
  setDeviceStatus,
  intervalMonths,
  setIntervalMonths,
  selectedHouseholdId,
  setSelectedHouseholdId,
  notes,
  setNotes,
  households = [],
}: DeviceDetailsFormProps) {
  const t = useTranslations("maintenance");
  const householdList = households ?? [];

  return (
    <fieldset className="space-y-4">
      <legend className="text-[9px] font-black uppercase tracking-widest text-[var(--text-muted)] mb-3">
        {t("wizard.deviceDetailsLegend")}
      </legend>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <label className="space-y-1.5">
          <span className="text-[9px] font-black uppercase tracking-wider text-[var(--text-muted)]">
            {t("wizard.name")} *
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
            {householdList.map((h) => (
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
  );
}
