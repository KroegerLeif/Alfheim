"use client";

import { AlfiMascot, useTranslation, type AlfiMascotProps } from "@alfheim/shared";
import { ArrowLeft } from "lucide-react";

interface ChatHeaderBarProps {
  mascotState: AlfiMascotProps["state"];
  /** Display name of the open conversation's own model; null hides the badge. */
  modelLabel: string | null;
  statusText: string;
  /** Returns to the conversation list on narrow screens, where only one pane is shown. */
  onBack?: () => void;
}

/** Top bar of an open conversation: ALFI, the conversation's model and the live status. */
export function ChatHeaderBar({ mascotState, modelLabel, statusText, onBack }: ChatHeaderBarProps) {
  const { t } = useTranslation();

  return (
    <div className="border-b border-[var(--border-subtle)] bg-[var(--surface-canvas)]/90 backdrop-blur-sm px-4 py-2 flex items-center gap-3 shadow-xs min-w-0">
      {onBack && (
        <button
          type="button"
          onClick={onBack}
          aria-label={t("Chat.backToConversations")}
          title={t("Chat.backToConversations")}
          className="md:hidden p-1 rounded-md text-[var(--text-muted)] hover:text-[var(--text-main)] cursor-pointer shrink-0"
        >
          <ArrowLeft className="w-4 h-4" />
        </button>
      )}
      <AlfiMascot state={mascotState} size="sm" showHalo={true} />
      <div className="flex flex-col min-w-0">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-xs font-bold text-[var(--text-main)] shrink-0">ALFI</span>
          {modelLabel && (
            <span
              title={`${t("Chat.conversationModel")}: ${modelLabel}`}
              className="text-[10px] text-[var(--text-muted)] font-mono px-1.5 py-0.5 rounded bg-[var(--surface-card)] border border-[var(--border-subtle)] truncate min-w-0 max-w-[16rem]"
            >
              {modelLabel}
            </span>
          )}
        </div>
        <span className="text-[11px] text-[var(--primary-main)] transition-colors duration-300 truncate">
          {statusText}
        </span>
      </div>
    </div>
  );
}
