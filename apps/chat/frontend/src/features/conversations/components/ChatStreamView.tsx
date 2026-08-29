"use client";

import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { AlfiAvatar, useTranslation } from "@alfheim/shared";
import { postMessage, streamAssistantReply } from "@/lib/api";
import {
  useCreateConversation,
  useMessages,
  useModelBlocks,
} from "@/features/conversations/services/conversationService";
import { MessageItem } from "./MessageItem";
import { ChatInput } from "./ChatInput";
import { ChatLandingState } from "./ChatLandingState";

interface ChatStreamViewProps {
  conversationId: string | null;
  selectedModelBlockId?: string;
  onConversationCreated?: (conversationId: string) => void;
  onOpenAddModel?: () => void;
}

/**
 * Renders a conversation's message history and attachments, driving the SSE
 * streaming endpoint to show assistant replies arriving incrementally.
 */
export function ChatStreamView({
  conversationId,
  selectedModelBlockId,
  onConversationCreated,
  onOpenAddModel,
}: ChatStreamViewProps) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { data: modelBlocks } = useModelBlocks();
  const { data: messages, isLoading, isError } = useMessages(conversationId);
  const createConversation = useCreateConversation();

  const [activeConvoId, setActiveConvoId] = useState<string | null>(conversationId);
  const [streamingText, setStreamingText] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamError, setStreamError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  // Sync internal active conversation ID when prop changes
  useEffect(() => {
    setActiveConvoId(conversationId);
  }, [conversationId]);

  // Cancel in-flight stream when switching conversations or unmounting
  useEffect(() => {
    return () => abortRef.current?.abort();
  }, [activeConvoId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView?.({ behavior: "smooth" });
  }, [messages, streamingText]);

  const effectiveConvoId = activeConvoId ?? conversationId;
  const currentModel =
    modelBlocks?.find((b) => b.id === selectedModelBlockId) || modelBlocks?.[0];

  const invalidateMessages = (targetId?: string) => {
    const id = targetId || effectiveConvoId;
    if (id) {
      queryClient.invalidateQueries({
        queryKey: ["chat", "conversations", id, "messages"],
      });
    }
  };

  const handleSend = async (content: string, attachmentIds: string[]) => {
    if (isStreaming) return;
    if (!content && attachmentIds.length === 0) return;

    setStreamError(null);
    let targetConvoId = effectiveConvoId;

    // If no conversation is active yet, create one on the fly with the active model
    if (!targetConvoId) {
      if (!currentModel) {
        setStreamError(t("Chat.noModelBlocksPrompt"));
        return;
      }
      try {
        const created = await createConversation.mutateAsync({
          model_block_id: currentModel.id,
        });
        targetConvoId = created.id;
        setActiveConvoId(created.id);
        onConversationCreated?.(created.id);
        queryClient.invalidateQueries({ queryKey: ["chat", "conversations"] });
      } catch (err) {
        setStreamError(
          err instanceof Error ? err.message : t("Chat.loadError")
        );
        return;
      }
    }

    try {
      await postMessage(targetConvoId, content, attachmentIds);
    } catch (err) {
      setStreamError(
        err instanceof Error ? err.message : t("Chat.streamError")
      );
      return;
    }
    invalidateMessages(targetConvoId);

    setIsStreaming(true);
    setStreamingText("");
    const controller = new AbortController();
    abortRef.current = controller;

    await streamAssistantReply(
      targetConvoId,
      {
        onDelta: (text) => setStreamingText((prev) => prev + text),
        onDone: () => {
          setIsStreaming(false);
          setStreamingText("");
          invalidateMessages(targetConvoId);
        },
        onError: (message) => {
          setIsStreaming(false);
          setStreamError(message);
        },
      },
      controller.signal
    );
  };

  if (!effectiveConvoId) {
    return (
      <ChatLandingState
        currentModel={currentModel}
        onOpenAddModel={onOpenAddModel}
        streamError={streamError}
        onSend={handleSend}
        isStreaming={isStreaming}
      />
    );
  }

  return (
    <div className="flex-1 flex flex-col h-full w-full min-w-0 bg-[var(--surface-canvas)]">
      <div className="flex-1 overflow-y-auto p-4 sm:p-6">
        <div className="max-w-4xl mx-auto w-full space-y-4">
          {isLoading && <p className="text-sm text-[var(--text-muted)]">…</p>}
          {isError && (
            <p className="text-sm text-red-400">{t("Chat.loadError")}</p>
          )}

          {messages?.map((message) => (
            <MessageItem key={message.id} message={message} />
          ))}

          {isStreaming && (
            <div className="max-w-3xl rounded-xl px-4 py-3 text-sm whitespace-pre-wrap bg-[var(--surface-card)] text-[var(--text-main)] border border-[var(--border-subtle)] shadow-xs">
              {streamingText || (
                <span className="text-[var(--text-muted)] flex items-center gap-2">
                  <AlfiAvatar status="thinking" size="sm" />
                  <span>{t("Chat.thinking")}</span>
                </span>
              )}
            </div>
          )}

          {streamError && <p className="text-sm text-red-400">{streamError}</p>}
          <div ref={messagesEndRef} />
        </div>
      </div>

      <div className="w-full max-w-4xl mx-auto">
        <ChatInput onSend={handleSend} disabled={isStreaming} />
      </div>
    </div>
  );
}
