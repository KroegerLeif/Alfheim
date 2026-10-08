"use client";

import React, { useState } from "react";
import { BucketMeter, MoneyDisplay, useTranslation } from "@alfheim/shared";
import { Pot, SinkingFundCalculationResponse } from "@/features/budget/types";
import { potsApi } from "../api/potsApi";
import { Edit2, Trash2, Calendar, AlertTriangle, CheckCircle2, RefreshCw } from "lucide-react";

export interface PotCardProps {
  pot: Pot;
  onEdit: (pot: Pot) => void;
  onDelete: (id: string) => void;
}

export function PotCard({ pot, onEdit, onDelete }: PotCardProps) {
  const { t } = useTranslation();
  const [calc, setCalc] = useState<SinkingFundCalculationResponse | null>(null);
  const [calcLoading, setCalcLoading] = useState(false);
  const [calcError, setCalcError] = useState<string | null>(null);

  const handleCalculateSinkingFund = async () => {
    setCalcLoading(true);
    setCalcError(null);
    try {
      setCalc(await potsApi.calculateSinkingFundGap(pot.id));
    } catch (err) {
      setCalc(null);
      setCalcError(err instanceof Error && err.message ? err.message : t("budget.errors.requestFailed"));
    } finally {
      setCalcLoading(false);
    }
  };

  const statusLabel = calc ? t(`budget.pots.status.${calc.status}`) : "";

  return (
    <div className="p-4 rounded-xl bg-[var(--surface-card)] border border-[var(--border-subtle)] space-y-3 shadow-xs hover:border-[var(--primary-main)]/30 transition-all min-w-0">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <span className="px-2 py-0.5 rounded text-[11px] font-mono font-bold bg-[var(--primary-main)]/10 text-[var(--primary-main)] shrink-0">
            {t("budget.pots.priorityBadge", { priority: pot.priority })}
          </span>
          <span className="text-[11px] uppercase tracking-wide text-[var(--text-muted)] font-mono truncate">
            {t(`budget.pots.overflow.${pot.overflow_target}`)}
          </span>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <button
            type="button"
            onClick={handleCalculateSinkingFund}
            aria-label={t("budget.pots.calculateGapLabel", { name: pot.name })}
            className="p-1.5 rounded-lg text-[var(--text-muted)] hover:bg-[var(--surface-canvas)] hover:text-[var(--text-main)]"
          >
            <RefreshCw className={`w-4 h-4 ${calcLoading ? "animate-spin" : ""}`} />
          </button>
          <button
            type="button"
            onClick={() => onEdit(pot)}
            aria-label={t("budget.pots.editLabel", { name: pot.name })}
            className="p-1.5 rounded-lg text-[var(--text-muted)] hover:bg-[var(--surface-canvas)] hover:text-[var(--text-main)]"
          >
            <Edit2 className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => onDelete(pot.id)}
            aria-label={t("budget.pots.deleteLabel", { name: pot.name })}
            className="p-1.5 rounded-lg text-rose-500 hover:bg-rose-500/10"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      <BucketMeter
        name={pot.name}
        currentAmount={pot.current_amount}
        targetAmount={pot.target_amount ?? pot.current_amount}
        priority={pot.priority}
      />

      <div className="flex items-center justify-between gap-2 text-xs text-[var(--text-muted)] pt-1">
        <div className="flex items-center gap-1 min-w-0">
          <Calendar className="w-3.5 h-3.5 shrink-0" />
          <span className="truncate">{pot.target_date ? pot.target_date : t("budget.pots.noDate")}</span>
        </div>
        <div className="shrink-0">
          <span>{t("budget.pots.monthly")}: </span>
          <MoneyDisplay amount={pot.monthly_contribution} size="sm" className="font-semibold" />
        </div>
      </div>

      {calcError && (
        <p role="alert" className="text-xs text-rose-500 break-words">
          {calcError}
        </p>
      )}

      {calc && (
        <div className="p-2.5 rounded-lg bg-[var(--surface-canvas)] border border-[var(--border-subtle)] text-xs space-y-1">
          <div className="flex items-center justify-between gap-2 font-medium">
            <span className="flex items-center gap-1 min-w-0">
              {calc.has_gap ? (
                <AlertTriangle className="w-3.5 h-3.5 text-amber-500 shrink-0" />
              ) : (
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
              )}
              <span className="truncate">{t("budget.pots.statusLabel", { status: statusLabel })}</span>
            </span>
            <span className="shrink-0">
              {t("budget.pots.monthlyTarget")}: <MoneyDisplay amount={calc.target_monthly_rate} size="sm" />
            </span>
          </div>
          {calc.shortfall > 0 && (
            <div className="text-[11px] text-[var(--text-muted)] flex justify-between gap-2">
              <span>
                {t("budget.pots.shortfall")}: <MoneyDisplay amount={calc.shortfall} size="sm" />
              </span>
              <span>
                {t("budget.pots.gap")}: <MoneyDisplay amount={calc.gap} size="sm" />
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
