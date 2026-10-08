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
  const [providerType, setProviderType] = useState<ProviderType>("STREAMING");
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
        provider_name: name.trim(),
        provider_type: providerType,
        is_active: true,
      });
      setName("");
      setProviderType("STREAMING");
      onClose();
    } catch {
      setError(t("library.providers.saveError"));
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md border-[var(--border-subtle)] bg-[var(--surface-card)]">
        <DialogHeader>
          <DialogTitle className="text-[var(--text-main)]">
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
            <label className="block text-xs font-semibold text-[var(--text-muted)] mb-1">
              {t("library.providers.providerName")} *
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={100}
              placeholder={t("library.providers.namePlaceholder")}
              className="w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-subtle)] px-3 py-2 text-sm text-[var(--text-main)] focus:border-primary focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-[var(--text-muted)] mb-1">
              {t("library.providers.providerType")}
            </label>
            <select
              value={providerType}
              onChange={(e) => setProviderType(e.target.value as ProviderType)}
              className="w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-subtle)] px-3 py-2 text-sm text-[var(--text-main)] focus:border-primary focus:outline-none"
            >
              <option value="STREAMING">{t("library.providers.typeStreaming")}</option>
              <option value="GAMING_PASS">{t("library.providers.typeGamePass")}</option>
              <option value="BOOK_PASS">{t("library.providers.typeBookPass")}</option>
            </select>
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
