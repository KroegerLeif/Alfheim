"use client";

import type { Message } from "@/features/conversations/types";

interface MessageItemProps {
  message: Message;
}

export function MessageItem({ message }: MessageItemProps) {
  const isUser = message.role === "user";

  return (
    <div
      className={`max-w-3xl sm:max-w-4xl rounded-xl px-4 py-3 text-sm whitespace-pre-wrap shadow-xs ${
        isUser
          ? "ml-auto bg-[var(--primary-main)] text-black font-medium"
          : "bg-[var(--surface-card)] text-[var(--text-main)] border border-[var(--border-subtle)]"
      }`}
    >
      {message.attachments && message.attachments.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-2">
          {message.attachments.map((att) => (
            <a
              key={att.id}
              href={att.url}
              target="_blank"
              rel="noopener noreferrer"
              className="block rounded-lg overflow-hidden border border-black/10 dark:border-white/10 hover:opacity-90 transition-opacity"
            >
              <img
                src={att.url}
                alt="Attachment"
                className="max-h-48 max-w-full rounded-lg object-contain bg-black/5 dark:bg-white/5"
                loading="lazy"
              />
            </a>
          ))}
        </div>
      )}

      {message.content && <div>{message.content}</div>}
    </div>
  );
}
