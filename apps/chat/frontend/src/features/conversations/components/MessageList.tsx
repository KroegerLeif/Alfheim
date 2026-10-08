"use client";

import { useEffect, useMemo, useRef } from "react";
import { AlfiAvatar, useTranslation } from "@alfheim/shared";
import type { Message, ToolCallView } from "@/features/conversations/types";
import { buildTimeline } from "@/features/conversations/utils/toolCalls";
import { MessageItem } from "./MessageItem";
import { ToolCallGroup } from "./ToolCallGroup";

interface MessageListProps {
  messages: Message[] | undefined;
  isLoading: boolean;
  isError: boolean;
  isStreaming: boolean;
  streamingText: string;
  liveToolCalls: ToolCallView[];
}

/** Stored history (with tool calls attached to their turn) plus the reply streaming in. */
export function MessageList({ messages, isLoading, isError, isStreaming, streamingText, liveToolCalls }: MessageListProps) {
  const { t } = useTranslation();
  const endRef = useRef<HTMLDivElement | null>(null);
  const timeline = useMemo(() => buildTimeline(messages ?? []), [messages]);

  useEffect(() => {
    endRef.current?.scrollIntoView?.({ behavior: "smooth" });
  }, [timeline, streamingText, liveToolCalls]);

  return (
    <>
      {isLoading && <p className="text-sm text-[var(--text-muted)]">{t("common.loading")}</p>}
      {isError && <p className="text-sm text-red-400">{t("Chat.loadError")}</p>}

      {timeline.map((item) =>
        item.kind === "message" ? (
          <MessageItem key={item.message.id} message={item.message} />
        ) : (
          <ToolCallGroup key={item.id} calls={item.calls} />
        )
      )}

      {isStreaming && <ToolCallGroup calls={liveToolCalls} />}

      {isStreaming && (
        <div className="flex gap-3 w-full justify-start">
          <AlfiAvatar status={streamingText ? "speaking" : "thinking"} size="sm" className="mt-1 shrink-0" />
          <div className="min-w-0 max-w-[85%] sm:max-w-3xl rounded-xl px-4 py-3 text-sm whitespace-pre-wrap break-words [overflow-wrap:anywhere] bg-[var(--surface-card)] text-[var(--text-main)] border border-[var(--border-subtle)] shadow-xs">
            {streamingText || (
              <span className="text-[var(--text-muted)] flex items-center gap-2">
                <span className="animate-pulse">{t("Chat.thinking")}</span>
              </span>
            )}
          </div>
        </div>
      )}
      <div ref={endRef} />
    </>
  );
}
