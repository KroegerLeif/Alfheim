import React, { useRef, useState } from "react";
import { Button, useTranslation } from "@alfheim/shared";

interface ManualUploadButtonProps {
  onFileSelect: (file: File) => Promise<void>;
  isUploading: boolean;
}

export function ManualUploadButton({
  onFileSelect,
  isUploading,
}: ManualUploadButtonProps) {
  const { t } = useTranslation();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);

  const handleClick = () => {
    setValidationError(null);
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const isPdfExtension = file.name.toLowerCase().endsWith(".pdf");
    const isPdfMime = !file.type || file.type === "application/pdf";

    if (!isPdfExtension || !isPdfMime) {
      setValidationError(t("library.manuals.pdfOnly"));
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
      return;
    }

    try {
      await onFileSelect(file);
    } catch {
      // Error is handled in parent hook/component
    } finally {
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  return (
    <div className="flex flex-col gap-1">
      <input
        ref={fileInputRef}
        type="file"
        accept="application/pdf,.pdf"
        className="hidden"
        onChange={handleFileChange}
      />
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={isUploading}
        onClick={handleClick}
      >
        {isUploading
          ? t("library.manuals.uploading")
          : t("library.manuals.uploadBtn")}
      </Button>
      {validationError && (
        <span className="text-xs text-red-400">{validationError}</span>
      )}
    </div>
  );
}
