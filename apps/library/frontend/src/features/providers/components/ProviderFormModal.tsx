import React, { useState } from "react";
import {
  Button,
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  useTranslation,
} from "@alfheim/shared";
import { ProviderCreatePayload, ProviderType } from "../types";

interface ProviderFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (payload: ProviderCreatePayload) => Promise<void>;
  isSubmitting?: boolean;
}

export function ProviderFormModal({
  isOpen,
  onClose,
  onSubmit,
  isSubmitting = false,
}: ProviderFormModalProps) {
  const { t } = useTranslation();
  const [name, setName] = useState("");
  const [providerType, setProviderType] = useState<ProviderType>("MOVIE");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError(t("library.providers.nameRequired"));
      return;
    }

    try {
      setError(null);
      await onSubmit({
        name: name.trim(),
        provider_type: providerType,
        is_active: true,
        notes: notes.trim() || undefined,
      });
      setName("");
      setNotes("");
      setProviderType("MOVIE");
      onClose();
    } catch {
      setError(t("library.itemDialog.saveError"));
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md border-[var(--border-main,#334155)] bg-[var(--surface-card,#1e293b)]">
        <DialogHeader>
          <DialogTitle className="text-[var(--text-main,#f8fafc)]">
            {t("library.providers.addProvider")}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 py-2">
          {error && (
            <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-xs text-red-400">
              {error}
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-[var(--text-muted,#94a3b8)] mb-1">
              {t("library.providers.providerName")} *
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="z.B. Netflix, PS Plus, Xbox Game Pass"
              className="w-full rounded-xl border border-[var(--border-main,#334155)] bg-[var(--surface-subtle,#0f172a)] px-3 py-2 text-sm text-[var(--text-main,#f8fafc)] focus:border-primary focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-[var(--text-muted,#94a3b8)] mb-1">
              {t("library.providers.providerType")}
            </label>
            <select
              value={providerType}
              onChange={(e) => setProviderType(e.target.value as ProviderType)}
              className="w-full rounded-xl border border-[var(--border-main,#334155)] bg-[var(--surface-subtle,#0f172a)] px-3 py-2 text-sm text-[var(--text-main,#f8fafc)] focus:border-primary focus:outline-none"
            >
              <option value="MOVIE">{t("library.providers.typeMovie")}</option>
              <option value="GAME">{t("library.providers.typeGame")}</option>
              <option value="BOTH">{t("library.providers.typeBoth")}</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-[var(--text-muted,#94a3b8)] mb-1">
              {t("library.lending.notes")}
            </label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder={t("library.providers.notesPlaceholder")}
              className="w-full rounded-xl border border-[var(--border-main,#334155)] bg-[var(--surface-subtle,#0f172a)] px-3 py-2 text-sm text-[var(--text-main,#f8fafc)] focus:border-primary focus:outline-none"
            />
          </div>

          <DialogFooter className="pt-2">
            <Button type="button" variant="ghost" onClick={onClose}>
              {t("library.itemDialog.cancel")}
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting
                ? t("library.providers.saving")
                : t("library.itemDialog.save")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
