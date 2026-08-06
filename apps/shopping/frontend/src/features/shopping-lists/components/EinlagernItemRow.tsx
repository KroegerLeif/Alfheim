"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Edit2, Save, SkipForward, Trash2, Check, X } from "lucide-react";
import { cn } from "@/lib/utils";
import type { UnrecognizedShoppingItem } from "../types";

export interface LocalStateItem extends UnrecognizedShoppingItem {
  resolved: "pending" | "saved" | "ignored" | "skipped";
  name: string;
  quantity: number;
  unit: string;
  catalogName?: string;
}

interface EinlagernItemRowProps {
  item: LocalStateItem;
  onEdit: (name: string, quantity: number, unit: string) => void;
  onSaveCatalog: (catalogName: string, unit: string) => Promise<void>;
  onSkip: () => void;
  onRemove: () => void;
  isCreateProductPending: boolean;
}

export function EinlagernItemRow({
  item,
  onEdit,
  onSaveCatalog,
  onSkip,
  onRemove,
  isCreateProductPending,
}: EinlagernItemRowProps) {
  const t = useTranslations("Modal");

  // Inline edit state
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState(item.name);
  const [editQty, setEditQty] = useState(String(item.quantity));
  const [editUnit, setEditUnit] = useState(item.unit);

  // Inline catalog registration state
  const [isSaving, setIsSaving] = useState(false);
  const [catalogInput, setCatalogInput] = useState(item.name);

  const startEdit = () => {
    setEditName(item.name);
    setEditQty(String(item.quantity));
    setEditUnit(item.unit);
    setIsEditing(true);
    setIsSaving(false);
  };

  const confirmEdit = () => {
    const trimmed = editName.trim();
    if (!trimmed) return;
    onEdit(trimmed, parseFloat(editQty) || 1, editUnit);
    setIsEditing(false);
  };

  const startSave = () => {
    setCatalogInput(item.name);
    setIsSaving(true);
    setIsEditing(false);
  };

  const confirmSave = async () => {
    const trimmed = catalogInput.trim();
    if (!trimmed) return;
    try {
      await onSaveCatalog(trimmed, item.unit);
      setIsSaving(false);
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div
      className={cn(
        "rounded-xl p-3.5 transition-all border",
        item.resolved === "pending"
          ? "glass-inset border-border/20"
          : "bg-white/2 dark:bg-white/[0.01] border-transparent opacity-40"
      )}
    >
      <div className="flex justify-between items-center gap-3">
        {isEditing ? (
          <div className="flex-1 flex gap-2 items-center">
            <input
              type="text"
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              className="flex-1 h-8 px-2 rounded bg-card border border-border/60 text-xs font-heading font-bold uppercase text-foreground outline-none min-w-0"
            />
            <input
              type="text"
              value={editQty}
              onChange={(e) => setEditQty(e.target.value)}
              className="w-12 h-8 px-2 rounded bg-card border border-border/60 text-xs font-mono font-bold text-foreground text-center outline-none"
            />
            <button
              onClick={confirmEdit}
              className="h-8 px-2.5 rounded bg-emerald-500 text-white font-bold text-xs cursor-pointer flex items-center justify-center shrink-0"
            >
              <Check className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={() => setIsEditing(false)}
              className="h-8 px-2.5 rounded bg-red-500 text-white font-bold text-xs cursor-pointer flex items-center justify-center shrink-0"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        ) : (
          <div className="min-w-0 flex-1">
            <div className="font-heading text-sm font-bold uppercase tracking-wider text-foreground truncate">
              {item.name}
            </div>
            <div className="font-mono text-[10px] text-muted-foreground/60 mt-0.5">
              {item.quantity} {item.unit}
              {item.resolved === "saved" && (
                <span className="text-cyan-600 dark:text-cyan-400 font-bold ml-2">
                  {t("savedLabel", { catalogName: item.catalogName ?? "" })}
                </span>
              )}
              {item.resolved === "skipped" && (
                <span className="text-amber-500 font-bold ml-2">{t("skippedLabel")}</span>
              )}
              {item.resolved === "ignored" && (
                <span className="text-muted-foreground/40 font-bold ml-2">{t("ignoredLabel")}</span>
              )}
            </div>
          </div>
        )}

        {item.resolved === "pending" && !isSaving && !isEditing && (
          <div className="flex gap-1 shrink-0 select-none">
            <button
              onClick={startEdit}
              className="p-1.5 rounded-lg glass-inset hover:glass-active text-muted-foreground hover:text-foreground cursor-pointer transition-colors"
              title={t("editItem")}
            >
              <Edit2 className="h-3.5 w-3.5" />
            </button>

            <button
              onClick={startSave}
              className="h-8 px-2.5 rounded-lg flex items-center justify-center gap-1 cursor-pointer glass-active font-heading text-[10px] font-black uppercase tracking-wider text-blue-500 dark:text-blue-400"
              title={t("saveToCatalog")}
            >
              <Save className="h-3 w-3 shrink-0" strokeWidth={2.5} />
              <span>{t("catalogBtn")}</span>
            </button>

            <button
              onClick={onSkip}
              className="p-1.5 rounded-lg glass-inset hover:glass-active text-muted-foreground hover:text-amber-400 cursor-pointer transition-colors"
              title={t("skipItem")}
            >
              <SkipForward className="h-3.5 w-3.5" />
            </button>

            <button
              onClick={onRemove}
              className="p-1.5 rounded-lg glass-inset hover:bg-red-500/10 text-muted-foreground hover:text-red-400 cursor-pointer transition-colors"
              title={t("ignoreBtn")}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        )}
      </div>

      {isSaving && (
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
              onClick={() => setIsSaving(false)}
              className="h-8 px-3 rounded-lg flex items-center justify-center font-heading text-xs font-black uppercase tracking-wider text-white bg-red-600 shrink-0 shadow-sm cursor-pointer"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
