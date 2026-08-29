"use client";

import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { AlfiAvatar, AlfiMascot, useAlfiChatLifecycle, useTranslation } from "@alfheim/shared";
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
 * streaming endpoint to show assistant replies arriving incrementally with a perched ALFI companion.
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
  const [isTyping, setIsTyping] = useState(false);
  const [streamError, setStreamError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  // Derive dynamic mascot state from real-time chat lifecycle
  const mascotState = useAlfiChatLifecycle({
    isTyping,
    isThinking: isStreaming && !streamingText,
    isStreaming: isStreaming && Boolean(streamingText),
    isError: Boolean(streamError),
  });

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

  const getCompanionStatusText = () => {
    if (streamError) return t("Chat.streamError");
    if (isStreaming && !streamingText) return t("Chat.statusThinking");
    if (isStreaming) return t("Chat.statusSpeaking");
    if (isTyping) return t("Chat.statusListening");
    return t("Chat.statusIdle");
  };

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
      {/* Perched ALFI Companion Top Bar */}
      <div className="border-b border-[var(--border-subtle)] bg-[var(--surface-canvas)]/90 backdrop-blur-sm px-4 py-2 flex items-center justify-between gap-3 shadow-xs">
        <div className="flex items-center gap-3">
          <AlfiMascot state={mascotState} size="sm" showHalo={true} />
          <div className="flex flex-col">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-[var(--text-main)]">ALFI</span>
              {currentModel && (
                <span className="text-[10px] text-[var(--text-muted)] font-mono px-1.5 py-0.5 rounded bg-[var(--surface-card)] border border-[var(--border-subtle)]">
                  {currentModel.display_name}
                </span>
              )}
            </div>
            <span className="text-[11px] text-[var(--primary-main)] transition-colors duration-300">
              {getCompanionStatusText()}
            </span>
          </div>
        </div>
      </div>

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
            <div className="flex gap-3 w-full justify-start">
              <AlfiAvatar status={streamingText ? "speaking" : "thinking"} size="sm" className="mt-1 shrink-0" />
              <div className="max-w-3xl sm:max-w-4xl rounded-xl px-4 py-3 text-sm whitespace-pre-wrap bg-[var(--surface-card)] text-[var(--text-main)] border border-[var(--border-subtle)] shadow-xs">
                {streamingText || (
                  <span className="text-[var(--text-muted)] flex items-center gap-2">
                    <span className="animate-pulse">{t("Chat.thinking")}</span>
                  </span>
                )}
              </div>
            </div>
          )}

          {streamError && <p className="text-sm text-red-400">{streamError}</p>}
          <div ref={messagesEndRef} />
        </div>
      </div>

      <div className="w-full max-w-4xl mx-auto">
        <ChatInput onSend={handleSend} onTypingChange={setIsTyping} disabled={isStreaming} />
      </div>
    </div>
  );
}
