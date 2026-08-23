"use client";

import React from "react";
import { X, Building2, ChevronDown, AlertCircle } from "lucide-react";
import { useTranslations } from "next-intl";

export interface HouseholdOption {
  id: string;
  name: string;
  is_default?: boolean;
}

interface EinlagernModalHeaderProps {
  allDone: boolean;
  pendingCount: number;
  onClose: () => void;
  households: HouseholdOption[];
  resolvedHouseholdId: string;
  setSelectedHouseholdId: (id: string) => void;
  selectedHousehold?: HouseholdOption;
}

export function EinlagernModalHeader({
  allDone,
  pendingCount,
  onClose,
  households,
  resolvedHouseholdId,
  setSelectedHouseholdId,
  selectedHousehold,
}: EinlagernModalHeaderProps) {
  const t = useTranslations("Modal");

  return (
    <>
      <div className="flex justify-between items-start gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-1.5 font-mono text-[10px] font-bold text-[var(--accent-cyan)] uppercase tracking-widest leading-none">
            <AlertCircle className="h-3.5 w-3.5 shrink-0" strokeWidth={2.5} />
            {t("scanTitle")}
          </div>
          <h2 className="font-heading text-xl font-black uppercase tracking-wide leading-none text-[var(--text-main)] whitespace-pre-line">
            {allDone ? t("allDoneTitle") : t("unresolvedTitle", { count: pendingCount })}
          </h2>
        </div>

        <button
          onClick={onClose}
          className="w-8 h-8 rounded-lg flex items-center justify-center cursor-pointer bg-[var(--surface-canvas)] hover:bg-[var(--surface-elevated)] border border-[var(--border-subtle)] text-[var(--text-muted)] hover:text-[var(--text-main)] shrink-0 transition-colors"
          title={t("close")}
          aria-label={t("close")}
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="p-3 rounded-xl bg-[var(--surface-elevated)] border border-[var(--border-subtle)] flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-xs font-heading font-extrabold uppercase text-[var(--text-main)]">
          <Building2 className="h-4 w-4 text-[var(--primary-main)] shrink-0" />
          <span>{t("targetHousehold")}</span>
        </div>

        {households.length > 1 ? (
          <div className="relative">
            <select
              value={resolvedHouseholdId}
              onChange={(e) => setSelectedHouseholdId(e.target.value)}
              className="appearance-none bg-[var(--surface-card)] border border-[var(--border-subtle)] rounded-lg px-3 py-1.5 pr-8 text-xs font-mono font-bold text-[var(--text-main)] outline-none cursor-pointer"
            >
              {households.map((hh) => (
                <option key={hh.id} value={hh.id}>
                  {hh.name} {hh.is_default ? t("defaultTag") : ""}
                </option>
              ))}
            </select>
            <ChevronDown className="h-3.5 w-3.5 text-[var(--text-muted)] pointer-events-none absolute right-2.5 top-2.5" />
          </div>
        ) : (
          <span className="font-mono text-xs font-bold text-[var(--primary-main)] px-2 py-1 rounded-md bg-[var(--primary-main)]/10 border border-[var(--primary-main)]/20">
            {selectedHousehold?.name || t("defaultTag")}
          </span>
        )}
      </div>
    </>
  );
}
