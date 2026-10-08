"use client";

import { useTranslation } from "@alfheim/shared";
import { RotateCcw } from "lucide-react";
import type { ChatFailure } from "@/features/conversations/hooks/useChatStream";

function headlineKey(failure: ChatFailure): string {
  switch (failure.stage) {
    case "noModel":
      return "Chat.noModelBlocksPrompt";
    case "create":
      return "Chat.createError";
    case "post":
      return "Chat.sendError";
    case "stopped":
      return "Chat.replyStopped";
    case "stream":
      return failure.failure.kind === "network" ? "Chat.networkError" : "Chat.streamError";
  }
}

function detailOf(failure: ChatFailure): string | undefined {
  if (failure.stage === "create" || failure.stage === "post") return failure.detail;
  if (failure.stage === "stream") return failure.failure.detail;
  return undefined;
}

interface FailureNoticeProps {
  failure: ChatFailure | null;
  onRetry: () => void;
}

/** Localized reason the last send produced no reply, with a retry action where one applies. */
export function FailureNotice({ failure, onRetry }: FailureNoticeProps) {
  const { t } = useTranslation();
  if (!failure) return null;

  const detail = detailOf(failure);
  const canRetry = failure.stage !== "noModel";
  const isStopped = failure.stage === "stopped";

  return (
    <div
      role={isStopped ? "status" : "alert"}
      className={`flex flex-wrap items-center gap-x-3 gap-y-1 text-sm min-w-0 ${isStopped ? "text-[var(--text-muted)]" : "text-red-400"}`}
    >
      <span className="min-w-0 break-words">{t(headlineKey(failure))}</span>
      {detail && (
        <span className="min-w-0 text-xs font-mono text-[var(--text-muted)] break-words [overflow-wrap:anywhere]">
          {detail}
        </span>
      )}
      {canRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="inline-flex items-center gap-1 rounded-md border border-[var(--border-subtle)] px-2 py-0.5 text-xs font-semibold text-[var(--text-main)] hover:border-[var(--primary-main)] cursor-pointer shrink-0"
        >
          <RotateCcw aria-hidden="true" className="w-3.5 h-3.5" />
          {t("Chat.retry")}
        </button>
      )}
    </div>
  );
}
