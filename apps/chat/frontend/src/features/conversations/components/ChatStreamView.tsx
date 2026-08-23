"use client";

import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "@alfheim/shared";
import { postMessage, streamAssistantReply } from "@/lib/api";
import { useMessages } from "@/features/conversations/services/conversationService";

interface ChatStreamViewProps {
  conversationId: string | null;
}

/**
 * Renders a conversation's message history plus an input box, and drives the SSE
 * streaming endpoint to show the assistant's reply arriving incrementally — this is
 * the primary surface for manually verifying the streaming pipeline end to end.
 */
export function ChatStreamView({ conversationId }: ChatStreamViewProps) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { data: messages, isLoading, isError } = useMessages(conversationId);

  const [input, setInput] = useState("");
  const [streamingText, setStreamingText] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamError, setStreamError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  // Cancel any in-flight stream when switching conversations or unmounting.
  useEffect(() => {
    return () => abortRef.current?.abort();
  }, [conversationId]);

  const invalidateMessages = () => {
    queryClient.invalidateQueries({ queryKey: ["chat", "conversations", conversationId, "messages"] });
  };

  const handleSend = async () => {
    const content = input.trim();
    if (!content || !conversationId || isStreaming) return;

    setInput("");
    setStreamError(null);

    try {
      await postMessage(conversationId, content);
    } catch (err) {
      setStreamError(err instanceof Error ? err.message : t("Chat.streamError"));
      return;
    }
    invalidateMessages();

    setIsStreaming(true);
    setStreamingText("");
    const controller = new AbortController();
    abortRef.current = controller;

    await streamAssistantReply(
      conversationId,
      {
        onDelta: (text) => setStreamingText((prev) => prev + text),
        onDone: () => {
          setIsStreaming(false);
          setStreamingText("");
          invalidateMessages();
        },
        onError: (message) => {
          setIsStreaming(false);
          setStreamError(message);
        },
      },
      controller.signal
    );
  };

  if (!conversationId) {
    return (
      <div className="flex-1 flex items-center justify-center text-[var(--text-muted)] text-sm">
        {t("Chat.noConversationSelected")}
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col h-full min-w-0">
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {isLoading && <p className="text-sm text-[var(--text-muted)]">…</p>}
        {isError && <p className="text-sm text-red-400">{t("Chat.loadError")}</p>}

        {messages?.map((message) => (
          <div
            key={message.id}
            className={`max-w-2xl rounded-xl px-4 py-2 text-sm whitespace-pre-wrap ${
              message.role === "user"
                ? "ml-auto bg-[var(--primary-main)] text-black"
                : "bg-[var(--surface-card)] text-[var(--text-main)]"
            }`}
          >
            {message.content}
          </div>
        ))}

        {isStreaming && (
          <div className="max-w-2xl rounded-xl px-4 py-2 text-sm whitespace-pre-wrap bg-[var(--surface-card)] text-[var(--text-main)]">
            {streamingText || <span className="text-[var(--text-muted)]">{t("Chat.thinking")}</span>}
          </div>
        )}

        {streamError && <p className="text-sm text-red-400">{streamError}</p>}
      </div>

      <div className="border-t border-[var(--border-subtle)] p-4 flex gap-2">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              void handleSend();
            }
          }}
          placeholder={t("Chat.inputPlaceholder")}
          className="flex-1 rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-canvas)] text-[var(--text-main)] text-sm px-3 py-2"
        />
        <button
          type="button"
          onClick={() => void handleSend()}
          disabled={!input.trim() || isStreaming}
          className="rounded-lg bg-[var(--primary-main)] text-black text-sm font-semibold px-4 py-2 disabled:opacity-50 cursor-pointer"
        >
          {t("Chat.send")}
        </button>
      </div>
    </div>
  );
}
