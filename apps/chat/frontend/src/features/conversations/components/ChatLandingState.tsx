"use client";

import { AlfiAvatar, useTranslation } from "@alfheim/shared";
import { Cpu, Plus } from "lucide-react";
import type { ModelBlock } from "@/features/conversations/types";
import { ChatInput } from "./ChatInput";

interface ChatLandingStateProps {
  currentModel?: ModelBlock;
  onOpenAddModel?: () => void;
  streamError: string | null;
  onSend: (content: string, attachmentIds: string[]) => void;
  isStreaming: boolean;
}

/**
 * Renders the empty landing state when no conversation is selected,
 * displaying the ALFI avatar, model selection indicator, and direct input.
 */
export function ChatLandingState({
  currentModel,
  onOpenAddModel,
  streamError,
  onSend,
  isStreaming,
}: ChatLandingStateProps) {
  const { t } = useTranslation();

  return (
    <div className="flex-1 flex flex-col h-full w-full min-w-0 bg-[var(--surface-canvas)]">
      <div className="flex-1 flex flex-col items-center justify-center p-6 text-center space-y-4 max-w-2xl mx-auto w-full">
        <AlfiAvatar status="idle" size="lg" />
        <div className="space-y-1.5 max-w-md">
          <h2 className="text-xl font-bold text-[var(--text-main)]">
            {t("Chat.welcomeTitle")}
          </h2>
          <p className="text-sm text-[var(--text-muted)]">{t("Chat.noConversationSelected")}</p>
        </div>

        {currentModel ? (
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-[var(--surface-card)] border border-[var(--border-subtle)] text-xs text-[var(--text-muted)] font-mono shadow-xs">
            <Cpu className="w-3.5 h-3.5 text-[var(--primary-main)]" />
            <span>{currentModel.display_name}</span>
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

        {streamError && (
          <p className="text-sm text-red-400 max-w-md">{streamError}</p>
        )}
      </div>

      {currentModel && (
        <div className="w-full max-w-4xl mx-auto">
          <ChatInput onSend={onSend} disabled={isStreaming} />
        </div>
      )}
    </div>
  );
}
