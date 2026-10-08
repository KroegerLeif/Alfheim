"use client";

import { useRef, useState } from "react";
import { useTranslation } from "@alfheim/shared";
import { Paperclip, Send, Square } from "lucide-react";
import { uploadAttachment } from "@/lib/api";
import { AttachmentPreview, type StagedAttachment } from "./AttachmentPreview";

interface ChatInputProps {
  onSend: (content: string, attachmentIds: string[]) => void;
  onTypingChange?: (isTyping: boolean) => void;
  /** While a reply streams, sending is blocked and the send button becomes a stop button. */
  isStreaming?: boolean;
  onStop?: () => void;
}

export function ChatInput({ onSend, onTypingChange, isStreaming = false, onStop }: ChatInputProps) {
  const { t } = useTranslation();
  const [input, setInput] = useState("");
  const [staged, setStaged] = useState<StagedAttachment[]>([]);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const hasPendingUploads = staged.some((s) => s.isUploading);
  const canSend = !isStreaming && !hasPendingUploads && (input.trim().length > 0 || staged.length > 0);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    // Reset native input value so the same file can be selected again
    e.target.value = "";

    const newItems: StagedAttachment[] = files.map((file) => ({
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
      file,
      previewUrl: URL.createObjectURL(file),
      isUploading: true,
    }));

    setStaged((prev) => [...prev, ...newItems]);

    for (const item of newItems) {
      try {
        const uploaded = await uploadAttachment(item.file);
        setStaged((prev) =>
          prev.map((s) => (s.id === item.id ? { ...s, isUploading: false, uploaded } : s))
        );
      } catch (err) {
        setStaged((prev) =>
          prev.map((s) =>
            s.id === item.id
              ? { ...s, isUploading: false, error: err instanceof Error ? err.message : t("Chat.uploadError") }
              : s
          )
        );
      }
    }
  };

  const handleRemove = (id: string) => {
    setStaged((prev) => {
      const item = prev.find((s) => s.id === id);
      if (item?.previewUrl) {
        URL.revokeObjectURL(item.previewUrl);
      }
      return prev.filter((s) => s.id !== id);
    });
  };

  const handleSend = () => {
    if (!canSend) return;

    const content = input.trim();
    const attachmentIds = staged
      .map((s) => s.uploaded?.id)
      .filter((id): id is string => typeof id === "string");

    // Clean up preview URLs
    staged.forEach((s) => {
      if (s.previewUrl) URL.revokeObjectURL(s.previewUrl);
    });

    setInput("");
    setStaged([]);
    onTypingChange?.(false);
    onSend(content, attachmentIds);
  };

  return (
    <div className="border-t border-[var(--border-subtle)] bg-[var(--surface-canvas)]">
      <AttachmentPreview attachments={staged} onRemove={handleRemove} />

      <div className="p-4 flex items-center gap-2">
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          multiple
          className="hidden"
          onChange={handleFileChange}
          disabled={isStreaming}
        />

        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={isStreaming || hasPendingUploads}
          aria-label={t("Chat.attachImage")}
          className="p-2 rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-card)] text-[var(--text-muted)] hover:text-[var(--text-main)] hover:bg-[var(--surface-canvas)] transition-colors disabled:opacity-50 cursor-pointer shrink-0"
        >
          <Paperclip className="w-4 h-4" />
        </button>

        <input
          type="text"
          value={input}
          onChange={(e) => {
            const val = e.target.value;
            setInput(val);
            onTypingChange?.(val.trim().length > 0);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              handleSend();
            }
          }}
          placeholder={t("Chat.inputPlaceholder")}
          aria-label={t("Chat.inputPlaceholder")}
          className="flex-1 min-w-0 rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-card)] text-[var(--text-main)] text-sm px-3 py-2 disabled:opacity-50"
        />

        {isStreaming && onStop ? (
          <button
            type="button"
            onClick={onStop}
            aria-label={t("Chat.stopReply")}
            title={t("Chat.stopReply")}
            className="flex items-center gap-1.5 rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-card)] text-[var(--text-main)] text-sm font-semibold px-4 py-2 hover:border-red-500 cursor-pointer shrink-0"
          >
            <Square className="w-4 h-4" />
            <span className="hidden sm:inline">{t("Chat.stop")}</span>
          </button>
        ) : (
          <button
            type="button"
            onClick={handleSend}
            disabled={!canSend}
            aria-label={t("Chat.send")}
            className="flex items-center gap-1.5 rounded-lg bg-[var(--primary-main)] text-black text-sm font-semibold px-4 py-2 disabled:opacity-50 cursor-pointer shrink-0"
          >
            <Send className="w-4 h-4" />
            <span className="hidden sm:inline">{t("Chat.send")}</span>
          </button>
        )}
      </div>
    </div>
  );
}
