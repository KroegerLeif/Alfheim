"use client";

import React, { useState } from "react";
import { BucketMeter, MoneyDisplay } from "@alfheim/shared";
import { Pot, SinkingFundCalculationResponse } from "@/features/budget/types";
import { potsApi } from "../api/potsApi";
import { Edit2, Trash2, Calendar, AlertTriangle, CheckCircle2, RefreshCw } from "lucide-react";

export interface PotCardProps {
  pot: Pot;
  onEdit: (pot: Pot) => void;
  onDelete: (id: string) => void;
}

export function PotCard({ pot, onEdit, onDelete }: PotCardProps) {
  const [calc, setCalc] = useState<SinkingFundCalculationResponse | null>(null);
  const [calcLoading, setCalcLoading] = useState(false);

  const handleCalculateSinkingFund = async () => {
    setCalcLoading(true);
    try {
      const res = await potsApi.calculateSinkingFundGap(pot.id);
      setCalc(res);
    } catch (err) {
      console.error("Failed to calculate sinking fund gap", err);
    } finally {
      setCalcLoading(false);
    }
  };

  return (
    <div className="p-4 rounded-xl bg-[var(--surface-card)] border border-[var(--border-subtle)] space-y-3 shadow-xs hover:border-[var(--primary-main)]/30 transition-all">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="px-2 py-0.5 rounded text-[11px] font-mono font-bold bg-[var(--primary-main)]/10 text-[var(--primary-main)]">
            Priority {pot.priority}
          </span>
          <span className="text-[11px] uppercase tracking-wide text-[var(--text-muted)] font-mono">
            {pot.overflow_target}
          </span>
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={handleCalculateSinkingFund}
            aria-label={`Calculate gap for ${pot.name}`}
            className="p-1.5 rounded-lg text-[var(--text-muted)] hover:bg-[var(--surface-canvas)] hover:text-[var(--text-main)]"
          >
            <RefreshCw className={`w-4 h-4 ${calcLoading ? "animate-spin" : ""}`} />
          </button>
          <button
            type="button"
            onClick={() => onEdit(pot)}
            aria-label={`Edit ${pot.name}`}
            className="p-1.5 rounded-lg text-[var(--text-muted)] hover:bg-[var(--surface-canvas)] hover:text-[var(--text-main)]"
          >
            <Edit2 className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => onDelete(pot.id)}
            aria-label={`Delete ${pot.name}`}
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

      <div className="flex items-center justify-between text-xs text-[var(--text-muted)] pt-1">
        <div className="flex items-center gap-1">
          <Calendar className="w-3.5 h-3.5" />
          <span>{pot.target_date ? pot.target_date : "No date"}</span>
        </div>
        <div>
          <span>Monthly: </span>
          <MoneyDisplay amount={pot.monthly_contribution} size="sm" className="font-semibold" />
        </div>
      </div>

      {calc && (
        <div className="p-2.5 rounded-lg bg-[var(--surface-canvas)] border border-[var(--border-subtle)] text-xs space-y-1">
          <div className="flex items-center justify-between font-medium">
            <span className="flex items-center gap-1">
              {calc.has_gap ? (
                <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
              ) : (
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
              )}
              <span>Status: {calc.status}</span>
            </span>
            <span>Monthly Target: <MoneyDisplay amount={calc.target_monthly_rate} size="sm" /></span>
          </div>
          {calc.shortfall > 0 && (
            <div className="text-[11px] text-[var(--text-muted)] flex justify-between">
              <span>Shortfall: <MoneyDisplay amount={calc.shortfall} size="sm" /></span>
              <span>Gap: <MoneyDisplay amount={calc.gap} size="sm" /></span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
