import React, { useState } from "react";
import { Button, useTranslation } from "@alfheim/shared";
import { useManual } from "../hooks/useManual";
import { ManualSectionProps } from "../types";
import { ManualUploadButton } from "./ManualUploadButton";
import { ManualViewerModal } from "./ManualViewerModal";

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
    if (window.confirm(confirmText)) {
      await deleteManual();
    }
  };

  return (
    <div className="space-y-2 rounded-lg border border-[var(--border-subtle,#334155)] p-3 bg-[var(--surface-muted,#0f172a)]/40">
      <div className="flex items-center justify-between">
        <h4 className="text-xs font-semibold text-[var(--text-main,#f8fafc)] uppercase tracking-wider">
          {t("library.manuals.title")}
        </h4>
        {hasManual && (
          <span className="text-[11px] text-emerald-400 font-medium">
            ✓ Uploaded
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
            📖 {t("library.manuals.viewBtn")}
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
            {isDeleting ? "..." : t("library.manuals.deleteBtn")}
          </Button>
        )}
      </div>

      {error && <p className="text-xs text-red-400 pt-1">{error}</p>}

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
