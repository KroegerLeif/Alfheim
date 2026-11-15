"use client";

import { useTranslation } from "@alfheim/shared";
import { X } from "lucide-react";
import { ModelBlockFormFields } from "./ModelBlockFormFields";
import { useModelBlockForm, type ModelBlockFormPayload } from "../hooks/useModelBlockForm";
import type { ModelBlock } from "../types";

interface ModelBlockFormModalProps {
  model?: ModelBlock | null;
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (payload: ModelBlockFormPayload) => void;
  isPending: boolean;
  /** The last submit failed; the form stays open so the input is not lost. */
  submitFailed?: boolean;
}

export function ModelBlockFormModal({
  model,
  isOpen,
  onClose,
  onSubmit,
  isPending,
  submitFailed = false,
}: ModelBlockFormModalProps) {
  const { t } = useTranslation();
  const form = useModelBlockForm(model, onSubmit);
  const { isEditing } = form;

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-label={isEditing ? t("Chat.editModelBlock") : t("Chat.addModelBlock")}
        className="w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-card)] p-4 sm:p-6 shadow-2xl space-y-4"
      >
        <div className="flex items-center justify-between border-b border-[var(--border-subtle)] pb-3">
          <h2 className="text-lg font-bold text-[var(--text-main)] truncate">
            {isEditing ? t("Chat.editModelBlock") : t("Chat.addModelBlock")}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label={t("Chat.close")}
            className="p-1 rounded text-[var(--text-muted)] hover:text-[var(--text-main)] cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={form.handleSubmit} className="space-y-3.5">
          <ModelBlockFormFields form={form} isPending={isPending} />

          {submitFailed && (
            <p role="alert" className="text-xs text-red-400">
              {t("Chat.saveModelError")}
            </p>
          )}

          <div className="pt-3 border-t border-[var(--border-subtle)] flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg text-xs font-semibold border border-[var(--border-subtle)] text-[var(--text-muted)] hover:text-[var(--text-main)] cursor-pointer"
            >
              {t("Chat.cancel")}
            </button>
            <button
              type="submit"
              disabled={isPending}
              className="px-4 py-2 rounded-lg text-xs font-semibold bg-[var(--primary-main)] text-black cursor-pointer disabled:opacity-50"
            >
              {t("Chat.save")}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
