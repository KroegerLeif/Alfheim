"use client";

import { useTranslations } from "next-intl";
import { Edit2, Save, SkipForward, Trash2 } from "lucide-react";

interface EinlagernItemActionsProps {
  onEdit: () => void;
  onSave: () => void;
  onSkip: () => void;
  onRemove: () => void;
}

/** Edit, save-to-catalog, skip and remove buttons of a pending stock-in row. */
export function EinlagernItemActions({ onEdit, onSave, onSkip, onRemove }: EinlagernItemActionsProps) {
  const t = useTranslations("Modal");

  return (
    <div className="flex gap-1 shrink-0 select-none">
      <button
        type="button"
        onClick={onEdit}
        className="p-1.5 rounded-lg glass-inset hover:glass-active text-muted-foreground hover:text-foreground cursor-pointer transition-colors"
        title={t("editItem")}
        aria-label={t("editItem")}
      >
        <Edit2 className="h-3.5 w-3.5" />
      </button>

      <button
        type="button"
        onClick={onSave}
        className="h-8 px-2.5 rounded-lg flex items-center justify-center gap-1 cursor-pointer glass-active font-heading text-[10px] font-black uppercase tracking-wider text-blue-500 dark:text-blue-400"
        title={t("saveToCatalog")}
        aria-label={t("saveToCatalog")}
      >
        <Save className="h-3 w-3 shrink-0" strokeWidth={2.5} />
        <span>{t("catalogBtn")}</span>
      </button>

      <button
        type="button"
        onClick={onSkip}
        className="p-1.5 rounded-lg glass-inset hover:glass-active text-muted-foreground hover:text-amber-400 cursor-pointer transition-colors"
        title={t("skipItem")}
        aria-label={t("skipItem")}
      >
        <SkipForward className="h-3.5 w-3.5" />
      </button>

      <button
        type="button"
        onClick={onRemove}
        className="p-1.5 rounded-lg glass-inset hover:bg-red-500/10 text-muted-foreground hover:text-red-400 cursor-pointer transition-colors"
        title={t("ignoreBtn")}
        aria-label={t("ignoreBtn")}
      >
        <Trash2 className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
