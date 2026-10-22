"use client";

import { useState } from "react";
import { ImageOff } from "lucide-react";
import { AlfiAvatar, useTranslation } from "@alfheim/shared";
import type { Message } from "@/features/conversations/types";

interface MessageItemProps {
  message: Message;
  /**
   * Called when an attachment image fails to load. The signed download URL expires, so
   * the parent refetches the messages to obtain fresh URLs.
   */
  onAttachmentError?: () => void;
}

export function MessageItem({ message, onAttachmentError }: MessageItemProps) {
  const { t } = useTranslation();
  // Keyed by URL: a refetch hands out a new signed URL, which is then tried again.
  const [failedUrls, setFailedUrls] = useState<ReadonlySet<string>>(new Set());
  const isUser = message.role === "user";
  const attachments = message.attachments ?? [];

  const handleImageError = (url: string) => {
    setFailedUrls((prev) => new Set(prev).add(url));
    onAttachmentError?.();
  };

  return (
    <div className={`flex gap-3 w-full ${isUser ? "justify-end" : "justify-start"}`}>
      {!isUser && (
        <AlfiAvatar status="idle" size="sm" className="mt-1 shrink-0" />
      )}
      <div
        className={`min-w-0 max-w-[85%] sm:max-w-3xl rounded-xl px-4 py-3 text-sm whitespace-pre-wrap break-words [overflow-wrap:anywhere] shadow-xs ${
          isUser
            ? "bg-[var(--primary-main)] text-black font-medium"
            : "bg-[var(--surface-card)] text-[var(--text-main)] border border-[var(--border-subtle)]"
        }`}
      >
        {attachments.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-2">
            {attachments.map((att) =>
              failedUrls.has(att.url) ? (
                <div
                  key={att.id}
                  role="img"
                  aria-label={t("Chat.attachmentUnavailable")}
                  className="flex items-center gap-2 rounded-lg border border-black/10 dark:border-white/10 px-3 py-2 text-xs font-normal opacity-80"
                >
                  <ImageOff className="w-4 h-4 shrink-0" aria-hidden="true" />
                  <span>{t("Chat.attachmentUnavailable")}</span>
                </div>
              ) : (
                <a
                  key={att.id}
                  href={att.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block rounded-lg overflow-hidden border border-black/10 dark:border-white/10 hover:opacity-90 transition-opacity"
                >
                  <img
                    src={att.url}
                    alt={t("Chat.attachmentAlt")}
                    className="max-h-48 max-w-full rounded-lg object-contain bg-black/5 dark:bg-white/5"
                    loading="lazy"
                    onError={() => handleImageError(att.url)}
                  />
                </a>
              )
            )}
          </div>
        )}

        {message.content && <div>{message.content}</div>}
      </div>
    </div>
  );
}
