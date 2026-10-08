"use client";

import { useState } from "react";
import { AlfiMascot, useAlfiChatLifecycle, useTranslation } from "@alfheim/shared";
import { Cpu, Plus } from "lucide-react";
import type { ModelBlock } from "@/features/conversations/types";
import type { ChatFailure } from "@/features/conversations/hooks/useChatStream";
import { ChatInput } from "./ChatInput";
import { FailureNotice } from "./FailureNotice";

interface ChatLandingStateProps {
  currentModel?: ModelBlock;
  onOpenAddModel?: () => void;
  failure: ChatFailure | null;
  onRetry: () => void;
  onSend: (content: string, attachmentIds: string[]) => void;
  isStreaming: boolean;
}

/**
 * Renders the empty landing state when no conversation is selected,
 * displaying the perched ALFI companion mascot, model selection indicator, and direct input.
 */
export function ChatLandingState({
  currentModel,
  onOpenAddModel,
  failure,
  onRetry,
  onSend,
  isStreaming,
}: ChatLandingStateProps) {
  const { t } = useTranslation();
  const [isTyping, setIsTyping] = useState(false);

  const mascotState = useAlfiChatLifecycle({
    isTyping,
    isThinking: isStreaming,
    isStreaming,
    isError: failure !== null && failure.stage !== "stopped",
  });

  return (
    <div className="flex-1 flex flex-col h-full w-full min-w-0 bg-[var(--surface-canvas)]">
      <div className="flex-1 flex flex-col items-center justify-center p-6 text-center space-y-4 max-w-2xl mx-auto w-full">
        <AlfiMascot state={mascotState} size="md" showHalo={true} />
        <div className="space-y-1 max-w-md">
          <h2 className="text-lg font-bold text-[var(--text-main)]">
            {t("Chat.welcomeTitle")}
          </h2>
          <p className="text-sm text-[var(--text-muted)]">{t("Chat.noConversationSelected")}</p>
        </div>

        {currentModel ? (
          <div
            title={t("Chat.newConversationModel")}
            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-[var(--surface-card)] border border-[var(--border-subtle)] text-xs text-[var(--text-muted)] font-mono shadow-xs max-w-full min-w-0"
          >
            <Cpu className="w-3.5 h-3.5 shrink-0 text-[var(--primary-main)]" />
            <span className="truncate">{currentModel.display_name}</span>
          </div>
        ) : (
          onOpenAddModel && (
            <button
              type="button"
              onClick={onOpenAddModel}
              className="px-3.5 py-2 rounded-xl bg-[var(--primary-main)] text-black text-xs font-bold flex items-center gap-1.5 hover:opacity-90 transition-opacity cursor-pointer shadow-sm"
            >
              <Plus className="w-4 h-4" />
              <span>{t("Chat.addModelBlock")}</span>
            </button>
          )
        )}

        <div className="max-w-md">
          <FailureNotice failure={failure} onRetry={onRetry} />
        </div>
      </div>

      {currentModel && (
        <div className="w-full max-w-4xl mx-auto">
          <ChatInput onSend={onSend} onTypingChange={setIsTyping} isStreaming={isStreaming} />
        </div>
      )}
    </div>
  );
}
