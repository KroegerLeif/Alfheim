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
import { LendItemPayload } from "../types";

interface LendItemDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  itemTitle?: string;
  onSubmit: (payload: LendItemPayload) => Promise<void>;
}

export function LendItemDialog({
  open,
  onOpenChange,
  itemTitle,
  onSubmit,
}: LendItemDialogProps) {
  const { t } = useTranslation();
  const [contactName, setContactName] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [notes, setNotes] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!contactName.trim()) return;

    setIsSubmitting(true);
    setError(null);
    try {
      await onSubmit({
        contact_name: contactName.trim(),
        due_date: dueDate ? dueDate : null,
        notes: notes.trim() ? notes.trim() : null,
      });
      setContactName("");
      setDueDate("");
      setNotes("");
      onOpenChange(false);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Error lending item");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md border border-[var(--border-main,#334155)] bg-[var(--surface-card,#1e293b)] text-[var(--text-main,#f8fafc)]">
        <DialogHeader>
          <DialogTitle>{t("library.lending.lendItem")}</DialogTitle>
          {itemTitle && (
            <p className="text-xs text-[var(--text-muted,#94a3b8)]">{itemTitle}</p>
          )}
        </DialogHeader>

        <form id="lend-form" onSubmit={handleSubmit} className="space-y-4 py-2">
          {error && (
            <div className="rounded-lg bg-red-500/10 border border-red-500/30 p-3 text-xs text-red-400">
              {error}
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-[var(--text-main,#f8fafc)] mb-1">
              {t("library.lending.borrower")} *
            </label>
            <input
              type="text"
              value={contactName}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                setContactName(e.target.value)
              }
              placeholder="e.g. John Doe"
              required
              className="w-full rounded-lg border border-[var(--border-main,#334155)] bg-[var(--surface-muted,#0f172a)] p-2 text-xs text-[var(--text-main,#f8fafc)] focus:outline-none focus:ring-2 focus:ring-primary/50"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-[var(--text-main,#f8fafc)] mb-1">
              {t("library.lending.dueDate")}
            </label>
            <input
              type="date"
              value={dueDate}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                setDueDate(e.target.value)
              }
              className="w-full rounded-lg border border-[var(--border-main,#334155)] bg-[var(--surface-muted,#0f172a)] p-2 text-xs text-[var(--text-main,#f8fafc)] focus:outline-none focus:ring-2 focus:ring-primary/50"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-[var(--text-main,#f8fafc)] mb-1">
              {t("library.lending.notes")}
            </label>
            <textarea
              value={notes}
              onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) =>
                setNotes(e.target.value)
              }
              rows={3}
              className="w-full rounded-lg border border-[var(--border-main,#334155)] bg-[var(--surface-muted,#0f172a)] p-2.5 text-xs text-[var(--text-main,#f8fafc)] focus:outline-none focus:ring-2 focus:ring-primary/50"
            />
          </div>
        </form>

        <DialogFooter className="flex justify-end gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onOpenChange(false)}
          >
            {t("library.itemDialog.cancel")}
          </Button>
          <Button
            type="submit"
            form="lend-form"
            size="sm"
            disabled={isSubmitting || !contactName.trim()}
          >
            {isSubmitting ? "..." : t("library.lending.lendItem")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
