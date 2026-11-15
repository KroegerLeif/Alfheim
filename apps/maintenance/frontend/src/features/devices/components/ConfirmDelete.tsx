"use client";

import React, { useState } from "react";
import { useTranslations } from "next-intl";
import { Trash2 } from "lucide-react";

interface ConfirmDeleteProps {
  /** Accessible name and label of the first button, e.g. "Delete device". */
  label: string;
  /** Question shown once the button was pressed. */
  question: string;
  onConfirm: () => void;
  isPending: boolean;
  /** Renders only the trash icon (with `label` as its accessible name) until confirmation. */
  iconOnly?: boolean;
}

/** A delete button that asks once inline before it calls `onConfirm`; nothing is deleted on the first click. */
export function ConfirmDelete({ label, question, onConfirm, isPending, iconOnly = false }: ConfirmDeleteProps) {
  const t = useTranslations("maintenance");
  const [asking, setAsking] = useState(false);

  if (!asking) {
    return (
      <button
        type="button"
        aria-label={label}
        title={label}
        onClick={() => setAsking(true)}
        className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-red-500/30 text-red-500 hover:bg-red-500/10 text-xs font-bold uppercase tracking-wider cursor-pointer"
      >
        <Trash2 className="h-3.5 w-3.5" />
        {!iconOnly && label}
      </button>
    );
  }

  return (
    <div role="alertdialog" aria-label={label} className="w-full space-y-2 p-3 rounded-xl border border-red-500/30 bg-red-500/5">
      <p className="text-xs text-[var(--text-main)] break-words">{question}</p>
      <div className="flex justify-end gap-2">
        <button
          type="button"
          onClick={() => setAsking(false)}
          className="px-3 py-1.5 rounded-lg border border-[var(--border-subtle)] text-xs font-bold uppercase text-[var(--text-muted)] cursor-pointer"
        >
          {t("wizard.cancel")}
        </button>
        <button
          type="button"
          disabled={isPending}
          onClick={onConfirm}
          className="px-3 py-1.5 rounded-lg bg-red-500 text-white text-xs font-bold uppercase disabled:opacity-50 cursor-pointer"
        >
          {t("deviceInventory.edit.confirmDelete")}
        </button>
      </div>
    </div>
  );
}
