import React from "react";
import {
  Button,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  useTranslation,
} from "@alfheim/shared";

interface ManualViewerModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  pdfUrl: string | null;
  isLoading: boolean;
}

export function ManualViewerModal({
  open,
  onOpenChange,
  title,
  pdfUrl,
  isLoading,
}: ManualViewerModalProps) {
  const { t } = useTranslation();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl border border-[var(--border-subtle)] bg-[var(--surface-card)] text-[var(--text-main)]">
        <DialogHeader>
          <DialogTitle>
            {t("library.manuals.title")} - {title}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 pt-2">
          {isLoading ? (
            <div className="flex h-96 items-center justify-center text-sm text-[var(--text-muted)]">
              Loading...
            </div>
          ) : pdfUrl ? (
            <div className="space-y-3">
              <div className="h-[60vh] w-full overflow-hidden rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-elevated)]">
                <iframe src={pdfUrl} title={title} className="h-full w-full" />
              </div>
              <div className="flex justify-end gap-2">
                <a
                  href={pdfUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center px-3 py-1.5 text-xs font-medium rounded-md border border-[var(--border-subtle)] bg-[var(--surface-card)] hover:bg-[var(--surface-elevated)] text-[var(--text-main)]"
                >
                  🔗 {t("library.manuals.openNewTab")}
                </a>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => onOpenChange(false)}
                >
                  {t("library.itemDialog.cancel")}
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex h-48 items-center justify-center text-sm text-red-400">
              {t("library.manuals.loadUrlError")}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
