"use client";

import * as React from "react";
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  useTranslation,
} from "@alfheim/shared";
import { describeApiError } from "@/core/apiError";
import { ErrorBanner } from "./ErrorBanner";

interface DeleteConfirmDialogProps {
  open: boolean;
  onClose: () => void;
  title: string;
  /** Localized question shown above the name of the record that will be deleted. */
  question: string;
  /** The user's own name for the record; rendered verbatim, never passed through translation. */
  name: string;
  /** Performs the delete; a rejection keeps the dialog open and shows the error. */
  onConfirm: () => Promise<unknown>;
  /** Translation key used when the server gives no more specific reason. */
  failureKey: string;
  /** Maps stable backend error codes (for example `product_in_use`) to translation keys. */
  codeKeys: Record<string, string>;
}

/**
 * DeleteConfirmDialog
 * Confirmation step for destructive actions. Conflicts such as "still in use" are shown inside the
 * dialog so the user sees why nothing was deleted.
 */
export function DeleteConfirmDialog({
  open, onClose, title, question, name, onConfirm, failureKey, codeKeys,
}: DeleteConfirmDialogProps) {
  const { t } = useTranslation();
  const [isDeleting, setIsDeleting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const close = () => { setError(null); onClose(); };

  const confirm = async () => {
    setIsDeleting(true);
    setError(null);
    try {
      await onConfirm();
      close();
    } catch (err: unknown) {
      setError(await describeApiError(err, t, failureKey, { codeKeys }));
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(next) => { if (!next) close(); }}>
      <DialogContent className="max-w-md border border-[var(--border-subtle)] bg-[var(--surface-card)] text-[var(--text-main)]">
        <DialogHeader>
          <DialogTitle className="break-words">{title}</DialogTitle>
          <DialogDescription>{question}</DialogDescription>
        </DialogHeader>
        <div className="space-y-3 py-2 min-w-0">
          <p className="break-words font-bold text-sm uppercase">{name}</p>
          {error && <ErrorBanner message={error} />}
        </div>
        <DialogFooter className="gap-2">
          <Button type="button" variant="outline" size="sm" onClick={close} disabled={isDeleting}>
            {t("common.cancel")}
          </Button>
          <Button type="button" variant="destructive" size="sm" onClick={confirm} disabled={isDeleting}>
            {t("common.delete")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
