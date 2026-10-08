"use client";

import { AlfiAvatar, useTranslation } from "@alfheim/shared";
import type { Message } from "@/features/conversations/types";

interface MessageItemProps {
  message: Message;
}

export function MessageItem({ message }: MessageItemProps) {
  const { t } = useTranslation();
  const isUser = message.role === "user";
  const attachments = message.attachments ?? [];

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
            {attachments.map((att) => (
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
                />
              </a>
            ))}
          </div>
        )}

        {message.content && <div>{message.content}</div>}
      </div>
    </div>
  );
}
