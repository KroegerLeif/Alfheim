import React from "react";
import { AlertCircle } from "lucide-react";

export interface ErrorBannerProps {
  message: string;
  actionLabel: string;
  onAction: () => void;
}

/** Dismissible or retryable error strip shown above the page content. Long messages wrap. */
export function ErrorBanner({ message, actionLabel, onAction }: ErrorBannerProps) {
  return (
    <div
      role="alert"
      className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-500 text-xs flex items-center justify-between gap-3"
    >
      <span className="flex items-center gap-2 min-w-0">
        <AlertCircle className="w-4 h-4 shrink-0" />
        <span className="break-words min-w-0">{message}</span>
      </span>
      <button type="button" onClick={onAction} className="font-bold underline shrink-0">
        {actionLabel}
      </button>
    </div>
  );
}
