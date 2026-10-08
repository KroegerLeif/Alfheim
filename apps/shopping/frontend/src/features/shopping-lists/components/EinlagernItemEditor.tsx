"use client";

import { useTranslations } from "next-intl";
import { Check, X } from "lucide-react";

interface EinlagernItemEditorProps {
  name: string;
  quantity: string;
  onNameChange: (value: string) => void;
  onQuantityChange: (value: string) => void;
  onConfirm: () => void;
  onCancel: () => void;
  isPending: boolean;
}

/** Inline name and quantity inputs of a stock-in row in edit mode. */
export function EinlagernItemEditor({
  name,
  quantity,
  onNameChange,
  onQuantityChange,
  onConfirm,
  onCancel,
  isPending,
}: EinlagernItemEditorProps) {
  const t = useTranslations("Modal");
  const tForm = useTranslations("AddForm");

  return (
    <div className="flex-1 flex gap-2 items-center min-w-0">
      <input
        type="text"
        value={name}
        onChange={(e) => onNameChange(e.target.value)}
        maxLength={255}
        aria-label={tForm("nameLabel")}
        className="flex-1 h-8 px-2 rounded bg-card border border-border/60 text-xs font-heading font-bold uppercase text-foreground outline-none min-w-0"
      />
      <input
        type="text"
        inputMode="decimal"
        value={quantity}
        onChange={(e) => onQuantityChange(e.target.value)}
        aria-label={tForm("quantityLabel")}
        className="w-12 h-8 px-2 rounded bg-card border border-border/60 text-xs font-mono font-bold text-foreground text-center outline-none shrink-0"
      />
      <button
        type="button"
        onClick={onConfirm}
        disabled={isPending}
        className="h-8 px-2.5 rounded bg-emerald-500 text-white font-bold text-xs cursor-pointer flex items-center justify-center shrink-0 disabled:opacity-40"
        title={t("confirmEdit")}
        aria-label={t("confirmEdit")}
      >
        <Check className="h-3.5 w-3.5" />
      </button>
      <button
        type="button"
        onClick={onCancel}
        className="h-8 px-2.5 rounded bg-red-500 text-white font-bold text-xs cursor-pointer flex items-center justify-center shrink-0"
        title={t("cancelEdit")}
        aria-label={t("cancelEdit")}
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
