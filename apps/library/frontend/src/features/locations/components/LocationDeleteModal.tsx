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
import type { LocationNode } from "../types";

interface LocationDeleteModalProps {
  isOpen: boolean;
  onClose: () => void;
  locationToDelete: LocationNode | null;
  onConfirm: (id: string) => Promise<void>;
}

export function LocationDeleteModal({
  isOpen,
  onClose,
  locationToDelete,
  onConfirm,
}: LocationDeleteModalProps) {
  const { t } = useTranslation();
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!locationToDelete) return null;

  const handleDelete = async () => {
    setIsDeleting(true);
    setError(null);
    try {
      await onConfirm(locationToDelete.id);
      onClose();
    } catch (err: unknown) {
      setError(
        err instanceof Error ? err.message : t("library.locations.deleteError")
      );
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="max-w-md border border-[var(--border-main,#334155)] bg-[var(--surface-card,#1e293b)] text-[var(--text-main,#f8fafc)]">
        <DialogHeader>
          <DialogTitle>{t("library.locations.deleteTitle")}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {error && (
            <div className="rounded-lg bg-red-500/10 border border-red-500/20 p-3 text-xs text-red-400">
              {error}
            </div>
          )}

          <p className="text-sm text-[var(--text-main,#f8fafc)]">
            {t("library.locations.deleteConfirm", { name: locationToDelete.name })}
          </p>
        </div>

        <DialogFooter className="flex justify-end gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onClose}
            disabled={isDeleting}
          >
            {t("library.itemDialog.cancel")}
          </Button>
          <Button
            type="button"
            variant="destructive"
            size="sm"
            onClick={handleDelete}
            disabled={isDeleting}
          >
            {isDeleting ? "..." : t("library.locations.delete")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
