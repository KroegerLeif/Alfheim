import * as React from "react";
import { Upload, FileText, X } from "lucide-react";
import { cn } from "../ui/utils/cn";
import { useTranslation } from "../i18n/utils/useTranslation";

export interface ReceiptDropzoneProps extends React.HTMLAttributes<HTMLDivElement> {
  onFileSelect: (file: File | null) => void;
  selectedFile?: File | null;
  accept?: string;
  maxSizeMB?: number;
  disabled?: boolean;
}

export function ReceiptDropzone({
  onFileSelect,
  selectedFile = null,
  accept = "image/*,application/pdf",
  maxSizeMB = 10,
  disabled = false,
  className,
  ...props
}: ReceiptDropzoneProps) {
  const { t } = useTranslation();
  const [isDragOver, setIsDragOver] = React.useState(false);
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);
  const inputRef = React.useRef<HTMLInputElement>(null);

  const validateAndSelect = (file: File) => {
    setErrorMessage(null);
    if (file.size > maxSizeMB * 1024 * 1024) {
      setErrorMessage(t("common.receipt.too_large", { size: maxSizeMB }));
      return;
    }
    onFileSelect(file);
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (disabled) return;
    setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragOver(false);
    if (disabled) return;
    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      validateAndSelect(files[0]);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      validateAndSelect(files[0]);
    }
  };

  const handleRemove = (e: React.MouseEvent) => {
    e.stopPropagation();
    onFileSelect(null);
    setErrorMessage(null);
    if (inputRef.current) {
      inputRef.current.value = "";
    }
  };

  return (
    <div className="w-full">
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => !disabled && !selectedFile && inputRef.current?.click()}
        className={cn(
          "relative flex flex-col items-center justify-center rounded-lg border-2 border-dashed p-6 text-center transition-colors cursor-pointer border-border bg-card",
          isDragOver && "border-primary bg-primary/5",
          disabled && "opacity-50 cursor-not-allowed",
          selectedFile && "border-solid border-primary/50 cursor-default",
          className
        )}
        {...props}
      >
        <input
          ref={inputRef}
          type="file"
          accept={accept}
          onChange={handleInputChange}
          disabled={disabled}
          aria-label={t("common.receipt.upload_label")}
          className="hidden"
          data-testid="receipt-input"
        />

        {selectedFile ? (
          <div className="flex items-center justify-between w-full gap-3 p-2 rounded bg-muted">
            <div className="flex items-center gap-2 overflow-hidden text-left">
              <FileText className="h-5 w-5 text-primary shrink-0" />
              <div className="truncate">
                <p className="text-sm font-medium truncate">{selectedFile.name}</p>
                <p className="text-xs text-muted-foreground font-mono">
                  {(selectedFile.size / 1024).toFixed(1)} KB
                </p>
              </div>
            </div>
            {!disabled && (
              <button
                type="button"
                onClick={handleRemove}
                className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-background transition-colors"
                aria-label={t("common.receipt.remove_file")}
              >
                <X aria-hidden="true" className="h-4 w-4" />
              </button>
            )}
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2">
            <Upload className="h-8 w-8 text-muted-foreground" />
            <div className="text-sm">
              <span className="font-semibold text-primary">{t("common.receipt.click_to_upload")}</span>{" "}
              {t("common.receipt.or_drag_and_drop")}
            </div>
            <p className="text-xs text-muted-foreground">{t("common.receipt.hint", { size: maxSizeMB })}</p>
          </div>
        )}
      </div>
      {errorMessage && <p className="mt-1.5 text-xs text-destructive">{errorMessage}</p>}
    </div>
  );
}
