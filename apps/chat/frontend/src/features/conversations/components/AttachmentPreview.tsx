"use client";

import { useTranslation } from "@alfheim/shared";
import { X, Image as ImageIcon, Loader2 } from "lucide-react";
import type { Attachment } from "@/features/conversations/types";

export interface StagedAttachment {
  id: string;
  file: File;
  previewUrl: string;
  uploaded?: Attachment;
  isUploading: boolean;
  error?: string;
}

interface AttachmentPreviewProps {
  attachments: StagedAttachment[];
  onRemove: (id: string) => void;
}

export function AttachmentPreview({ attachments, onRemove }: AttachmentPreviewProps) {
  const { t } = useTranslation();

  if (attachments.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-2 px-4 pt-3 pb-1 border-t border-[var(--border-subtle)] bg-[var(--surface-canvas)]">
      {attachments.map((item) => (
        <div
          key={item.id}
          className="relative group flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-[var(--surface-card)] border border-[var(--border-subtle)] max-w-xs text-xs text-[var(--text-main)]"
        >
          {item.previewUrl ? (
            <img
              src={item.previewUrl}
              alt={item.file.name}
              className="w-8 h-8 rounded object-cover border border-[var(--border-subtle)] flex-shrink-0"
            />
          ) : (
            <ImageIcon className="w-5 h-5 text-[var(--text-muted)] flex-shrink-0" />
          )}

          <div className="flex flex-col min-w-0 pr-4">
            <span className="truncate font-medium">{item.file.name}</span>
            <span className="text-[10px] text-[var(--text-muted)]">
              {(item.file.size / 1024).toFixed(1)} KB
            </span>
          </div>

          {item.isUploading && (
            <Loader2 className="w-4 h-4 animate-spin text-[var(--primary-main)] flex-shrink-0" />
          )}

          {item.error && (
            <span className="text-red-400 text-[10px] truncate" title={item.error}>
              {t("Chat.uploadError")}
            </span>
          )}

          <button
            type="button"
            onClick={() => onRemove(item.id)}
            disabled={item.isUploading}
            aria-label={t("Chat.removeAttachment")}
            className="absolute top-1 right-1 p-0.5 rounded-full bg-[var(--surface-canvas)] hover:bg-[var(--border-subtle)] text-[var(--text-muted)] hover:text-[var(--text-main)] transition-colors cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      ))}
    </div>
  );
}
