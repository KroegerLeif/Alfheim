"use client";

import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "@alfheim/shared";
import { postMessage, streamAssistantReply } from "@/lib/api";
import { useMessages } from "@/features/conversations/services/conversationService";
import { MessageItem } from "./MessageItem";
import { ChatInput } from "./ChatInput";

interface ChatStreamViewProps {
  conversationId: string | null;
}

/**
 * Renders a conversation's message history and attachments, driving the SSE
 * streaming endpoint to show assistant replies arriving incrementally.
 */
export function ChatStreamView({ conversationId }: ChatStreamViewProps) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { data: messages, isLoading, isError } = useMessages(conversationId);

  const [streamingText, setStreamingText] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamError, setStreamError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  // Cancel in-flight stream when switching conversations or unmounting
  useEffect(() => {
    return () => abortRef.current?.abort();
  }, [conversationId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView?.({ behavior: "smooth" });
  }, [messages, streamingText]);

  const invalidateMessages = () => {
    queryClient.invalidateQueries({ queryKey: ["chat", "conversations", conversationId, "messages"] });
  };

  const handleSend = async (content: string, attachmentIds: string[]) => {
    if (!conversationId || isStreaming) return;
    if (!content && attachmentIds.length === 0) return;

    setStreamError(null);

    try {
      await postMessage(conversationId, content, attachmentIds);
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
          <MessageItem key={message.id} message={message} />
        ))}

        {isStreaming && (
          <div className="max-w-2xl rounded-xl px-4 py-2 text-sm whitespace-pre-wrap bg-[var(--surface-card)] text-[var(--text-main)]">
            {streamingText || <span className="text-[var(--text-muted)]">{t("Chat.thinking")}</span>}
          </div>
        )}

        {streamError && <p className="text-sm text-red-400">{streamError}</p>}
        <div ref={messagesEndRef} />
      </div>

      <ChatInput onSend={handleSend} disabled={isStreaming} />
    </div>
  );
}
