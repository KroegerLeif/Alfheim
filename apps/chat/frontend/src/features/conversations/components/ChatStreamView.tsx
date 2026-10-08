"use client";

import { useState } from "react";
import { useAlfiChatLifecycle, useTranslation } from "@alfheim/shared";
import {
  useConversations,
  useMessages,
  useModelBlocks,
} from "@/features/conversations/services/conversationService";
import { useChatStream } from "@/features/conversations/hooks/useChatStream";
import { ChatInput } from "./ChatInput";
import { ChatLandingState } from "./ChatLandingState";
import { ChatHeaderBar } from "./ChatHeaderBar";
import { FailureNotice } from "./FailureNotice";
import { MessageList } from "./MessageList";

interface ChatStreamViewProps {
  conversationId: string | null;
  /** Model block chosen in the sidebar for the next new conversation. */
  selectedModelBlockId?: string;
  onConversationCreated?: (conversationId: string) => void;
  onOpenAddModel?: () => void;
  onBack?: () => void;
}

/**
 * Renders a conversation's message history and tool calls, driving the SSE streaming
 * endpoint to show assistant replies arriving incrementally with a perched ALFI companion.
 */
export function ChatStreamView({
  conversationId,
  selectedModelBlockId,
  onConversationCreated,
  onOpenAddModel,
  onBack,
}: ChatStreamViewProps) {
  const { t } = useTranslation();
  const { data: modelBlocks } = useModelBlocks();
  const { data: conversations } = useConversations();
  const blocks = modelBlocks ?? [];
  const newConversationModel = blocks.find((b) => b.id === selectedModelBlockId) ?? blocks[0];

  const chat = useChatStream({
    conversationId,
    newConversationModelId: newConversationModel?.id,
    onConversationCreated,
  });
  const { data: messages, isLoading, isError } = useMessages(chat.activeId);
  const [isTyping, setIsTyping] = useState(false);

  const hasStreamError = chat.failure !== null && chat.failure.stage !== "stopped";
  const mascotState = useAlfiChatLifecycle({
    isTyping,
    isThinking: chat.isStreaming && !chat.streamingText,
    isStreaming: chat.isStreaming && Boolean(chat.streamingText),
    isError: hasStreamError,
  });

  if (!chat.activeId) {
    return (
      <ChatLandingState
        currentModel={newConversationModel}
        onOpenAddModel={onOpenAddModel}
        failure={chat.failure}
        onRetry={chat.retry}
        onSend={chat.send}
        isStreaming={chat.isStreaming}
      />
    );
  }

  // The badge shows the model the open conversation is bound to, never the sidebar's
  // choice for new conversations (#572).
  const conversation =
    (conversations ?? []).find((c) => c.id === chat.activeId) ??
    (chat.created?.id === chat.activeId ? chat.created : undefined);
  const modelLabel = conversation
    ? blocks.find((b) => b.id === conversation.model_block_id)?.display_name ?? t("Chat.modelUnavailable")
    : null;

  const statusText = hasStreamError
    ? t("Chat.streamError")
    : chat.isStreaming && !chat.streamingText
      ? t("Chat.statusThinking")
      : chat.isStreaming
        ? t("Chat.statusSpeaking")
        : isTyping
          ? t("Chat.statusListening")
          : t("Chat.statusIdle");

  return (
    <div className="flex-1 flex flex-col h-full w-full min-w-0 bg-[var(--surface-canvas)]">
      <ChatHeaderBar mascotState={mascotState} modelLabel={modelLabel} statusText={statusText} onBack={onBack} />

      <div className="flex-1 overflow-y-auto p-4 sm:p-6">
        <div className="max-w-4xl mx-auto w-full space-y-4">
          <MessageList
            messages={messages}
            isLoading={isLoading}
            isError={isError}
            isStreaming={chat.isStreaming}
            streamingText={chat.streamingText}
            liveToolCalls={chat.liveToolCalls}
          />
          <FailureNotice failure={chat.failure} onRetry={chat.retry} />
        </div>
      </div>

      <div className="w-full max-w-4xl mx-auto">
        <ChatInput onSend={chat.send} onTypingChange={setIsTyping} isStreaming={chat.isStreaming} onStop={chat.stop} />
      </div>
    </div>
  );
}
