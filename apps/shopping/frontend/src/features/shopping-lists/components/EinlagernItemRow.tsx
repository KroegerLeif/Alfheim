"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import type { LocalStateItem } from "../hooks/useEinlagernItems";
import { unitLabel } from "../utils/units";
import { EinlagernCatalogForm } from "./EinlagernCatalogForm";
import { EinlagernItemActions } from "./EinlagernItemActions";
import { EinlagernItemEditor } from "./EinlagernItemEditor";

interface EinlagernItemRowProps {
  item: LocalStateItem;
  /** Persists an edit; rejects with a localized message when it fails. */
  onEdit: (name: string, quantity: number) => Promise<void>;
  /** Creates the catalog entry and stocks the item; rejects with a localized message when a step fails. */
  onSaveCatalog: (catalogName: string) => Promise<void>;
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
  const tUnits = useTranslations("Units");

  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState(item.name);
  const [editQty, setEditQty] = useState(String(item.quantity));
  const [isSaving, setIsSaving] = useState(false);
  const [catalogInput, setCatalogInput] = useState(item.name);
  const [error, setError] = useState<string | null>(null);

  const run = async (action: () => Promise<void>, onDone: () => void) => {
    setError(null);
    try {
      await action();
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  const startEdit = () => {
    setEditName(item.name);
    setEditQty(String(item.quantity));
    setError(null);
    setIsEditing(true);
    setIsSaving(false);
  };

  const confirmEdit = () => {
    const trimmed = editName.trim();
    if (!trimmed) return;
    void run(() => onEdit(trimmed, parseFloat(editQty) || 1), () => setIsEditing(false));
  };

  const startSave = () => {
    setCatalogInput(item.name);
    setError(null);
    setIsSaving(true);
    setIsEditing(false);
  };

  const confirmSave = () => {
    const trimmed = catalogInput.trim();
    if (!trimmed) return;
    void run(() => onSaveCatalog(trimmed), () => setIsSaving(false));
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
          <EinlagernItemEditor
            name={editName}
            quantity={editQty}
            onNameChange={setEditName}
            onQuantityChange={setEditQty}
            onConfirm={confirmEdit}
            onCancel={() => setIsEditing(false)}
            isPending={isCreateProductPending}
          />
        ) : (
          <div className="min-w-0 flex-1">
            <div className="font-heading text-sm font-bold uppercase tracking-wider text-foreground truncate" title={item.name}>
              {item.name}
            </div>
            <div className="font-mono text-[10px] text-muted-foreground/60 mt-0.5 break-words">
              {item.quantity} {unitLabel(item.unit, tUnits)}
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
          <EinlagernItemActions onEdit={startEdit} onSave={startSave} onSkip={onSkip} onRemove={onRemove} />
        )}
      </div>

      {isSaving && (
        <EinlagernCatalogForm
          catalogInput={catalogInput}
          setCatalogInput={setCatalogInput}
          confirmSave={confirmSave}
          onCancel={() => setIsSaving(false)}
          isCreateProductPending={isCreateProductPending}
        />
      )}

      {error && (
        <p role="alert" className="mt-2 text-[11px] font-bold text-red-400 leading-snug break-words">
          {error}
        </p>
      )}
    </div>
  );
}
