import React, { useState } from "react";
import { BookOpen, Check } from "lucide-react";
import { Button, useTranslation } from "@alfheim/shared";
import { useManual } from "../hooks/useManual";
import { ManualSectionProps } from "../types";
import { ManualUploadButton } from "./ManualUploadButton";
import { ManualViewerModal } from "./ManualViewerModal";

const MANUAL_ERROR_KEYS = {
  upload: "library.manuals.uploadError",
  url: "library.manuals.loadUrlError",
  delete: "library.manuals.deleteError",
} as const;

export function ManualSection({
  itemId,
  itemTitle,
  manualS3Key,
  onManualUpdated,
}: ManualSectionProps) {
  const { t } = useTranslation();
  const [isViewerOpen, setIsViewerOpen] = useState(false);

  const {
    isUploading,
    isDeleting,
    isFetchingUrl,
    downloadUrl,
    error,
    uploadManual,
    fetchManualUrl,
    deleteManual,
  } = useManual(itemId, onManualUpdated);

  const hasManual = Boolean(manualS3Key);

  const handleOpenViewer = async () => {
    setIsViewerOpen(true);
    await fetchManualUrl();
  };

  const handleDelete = async () => {
    const confirmText = t("library.manuals.deleteConfirm", { title: itemTitle });
    if (!window.confirm(confirmText)) return;
    try {
      await deleteManual();
    } catch {
      // useManual records the failure in `error`, which is rendered below.
    }
  };

  return (
    <div className="space-y-2 rounded-lg border border-[var(--border-subtle)] p-3 bg-[var(--surface-elevated)]/40">
      <div className="flex items-center justify-between">
        <h4 className="text-xs font-semibold text-[var(--text-main)] uppercase tracking-wider">
          {t("library.manuals.title")}
        </h4>
        {hasManual && (
          <span className="inline-flex items-center gap-1 text-[11px] text-emerald-400 font-medium">
            <Check className="h-3 w-3" aria-hidden="true" />
            {t("library.manuals.uploaded")}
          </span>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2 pt-1">
        {hasManual && (
          <Button
            type="button"
            variant="default"
            size="sm"
            onClick={handleOpenViewer}
          >
            <BookOpen className="h-4 w-4 shrink-0" aria-hidden="true" />
            {t("library.manuals.viewBtn")}
          </Button>
        )}

        <ManualUploadButton
          onFileSelect={uploadManual}
          isUploading={isUploading}
        />

        {hasManual && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={isDeleting}
            onClick={handleDelete}
            className="text-red-400 hover:text-red-300"
          >
            {isDeleting ? t("library.manuals.deleting") : t("library.manuals.deleteBtn")}
          </Button>
        )}
      </div>

      {error && (
        <p role="alert" className="text-xs text-red-400 pt-1">
          {t(MANUAL_ERROR_KEYS[error])}
        </p>
      )}

      <ManualViewerModal
        open={isViewerOpen}
        onOpenChange={setIsViewerOpen}
        title={itemTitle}
        pdfUrl={downloadUrl}
        isLoading={isFetchingUrl}
      />
    </div>
  );
}
