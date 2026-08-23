"use client";

import React from "react";
import { useTranslations } from "next-intl";
import { X } from "lucide-react";

interface EinlagernCatalogFormProps {
  catalogInput: string;
  setCatalogInput: (val: string) => void;
  confirmSave: () => void;
  onCancel: () => void;
  isCreateProductPending: boolean;
}

export function EinlagernCatalogForm({
  catalogInput,
  setCatalogInput,
  confirmSave,
  onCancel,
  isCreateProductPending,
}: EinlagernCatalogFormProps) {
  const t = useTranslations("Modal");

  return (
    <div className="mt-3 pt-2.5 border-t border-border/10 flex flex-col gap-2 select-none">
      <label className="font-mono text-[8px] font-bold text-blue-500 uppercase tracking-widest leading-none">
        {t("catalogBlueprintName")}
      </label>
      <div className="flex gap-2">
        <input
          value={catalogInput}
          onChange={(e) => setCatalogInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && confirmSave()}
          autoFocus
          disabled={isCreateProductPending}
          className="flex-1 h-8 px-3 rounded-lg bg-white/5 border border-border/30 outline-none font-heading text-xs font-semibold tracking-wide text-foreground min-w-0"
        />
        <button
          onClick={confirmSave}
          disabled={isCreateProductPending || !catalogInput.trim()}
          className="h-8 px-3 rounded-lg flex items-center justify-center font-heading text-xs font-black uppercase tracking-wider text-white bg-gradient-to-br from-blue-400 to-blue-800 disabled:opacity-40 shrink-0 border border-blue-900 shadow-sm cursor-pointer"
        >
          {isCreateProductPending ? "..." : t("saveBtn")}
        </button>
        <button
          onClick={onCancel}
          className="h-8 px-3 rounded-lg flex items-center justify-center font-heading text-xs font-black uppercase tracking-wider text-white bg-red-600 shrink-0 shadow-sm cursor-pointer"
          title={t("cancelSave")}
          aria-label={t("cancelSave")}
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
