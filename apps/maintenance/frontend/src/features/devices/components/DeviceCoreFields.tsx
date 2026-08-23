"use client";

import React from "react";
import { useTranslations } from "next-intl";

interface DeviceCoreFieldsProps {
  name: string;
  setName: (v: string) => void;
  model: string;
  setModel: (v: string) => void;
  serial: string;
  setSerial: (v: string) => void;
  location: string;
  setLocation: (v: string) => void;
}

export function DeviceCoreFields({
  name,
  setName,
  model,
  setModel,
  serial,
  setSerial,
  location,
  setLocation,
}: DeviceCoreFieldsProps) {
  const t = useTranslations("maintenance");

  return (
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
  );
}
