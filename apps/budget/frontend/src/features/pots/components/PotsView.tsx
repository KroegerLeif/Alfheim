"use client";

import React from "react";
import { useTranslation } from "@alfheim/shared";
import { Pot } from "@/features/budget/types";
import { PotCard } from "./PotCard";
import { Plus } from "lucide-react";

export interface PotsViewProps {
  pots: Pot[];
  onCreate: () => void;
  onEdit: (pot: Pot) => void;
  onDelete: (id: string) => void;
}

/** The "Pots" tab: all virtual pots with a create button. */
export function PotsView({ pots, onCreate, onEdit, onDelete }: PotsViewProps) {
  const { t } = useTranslation();

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-base font-semibold text-[var(--text-main)]">{t("budget.navigation.pots")}</h3>
        <button
          type="button"
          onClick={onCreate}
          className="px-3 py-1.5 rounded-lg bg-[var(--primary-main)] text-white text-xs font-medium flex items-center gap-1.5"
        >
          <Plus className="w-4 h-4" />
          <span>{t("budget.pots.createPot")}</span>
        </button>
      </div>
      {(pots ?? []).length === 0 ? (
        <div className="p-6 text-center rounded-xl bg-[var(--surface-card)] border border-[var(--border-subtle)] text-xs text-[var(--text-muted)]">
          {t("budget.pots.emptyState")}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {(pots ?? []).map((pot) => (
            <PotCard key={pot.id} pot={pot} onEdit={onEdit} onDelete={onDelete} />
          ))}
        </div>
      )}
    </div>
  );
}
