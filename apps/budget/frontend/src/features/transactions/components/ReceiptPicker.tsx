"use client";

import React from "react";
import { useTranslation } from "@alfheim/shared";
import { Paperclip } from "lucide-react";

export interface ReceiptPickerProps {
  file: File | null;
  onChange: (file: File | null) => void;
}

/** File picker for an optional receipt image or PDF. The chosen file name is truncated. */
export function ReceiptPicker({ file, onChange }: ReceiptPickerProps) {
  const { t } = useTranslation();

  return (
    <div className="flex items-center gap-2 min-w-0">
      <label
        htmlFor="transaction-receipt"
        className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-[var(--surface-canvas)] border border-[var(--border-subtle)] text-xs text-[var(--text-muted)] cursor-pointer hover:text-[var(--text-main)] min-w-0"
      >
        <Paperclip className="w-3.5 h-3.5 shrink-0" />
        <span className="truncate max-w-[180px]" title={file?.name}>
          {file ? file.name : t("budget.transactions.receiptAttachPrompt")}
        </span>
      </label>
      <input
        id="transaction-receipt"
        type="file"
        accept="image/*,application/pdf"
        className="sr-only"
        onChange={(e) => onChange(e.target.files?.[0] ?? null)}
      />
    </div>
  );
}
