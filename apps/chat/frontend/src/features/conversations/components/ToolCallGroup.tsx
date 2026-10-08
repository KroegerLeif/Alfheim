"use client";

import { useTranslation } from "@alfheim/shared";
import { CheckCircle2, ChevronRight, CircleAlert, CircleDashed, Loader2, Wrench } from "lucide-react";
import type { ToolCallStatus, ToolCallView } from "@/features/conversations/types";
import { formatToolArguments, redactText } from "@/features/conversations/utils/toolCalls";

const STATUS_KEYS: Record<ToolCallStatus, string> = {
  running: "Chat.toolStatusRunning",
  done: "Chat.toolStatusDone",
  error: "Chat.toolStatusError",
  no_result: "Chat.toolStatusNoResult",
};

function StatusIcon({ status }: { status: ToolCallStatus }) {
  const className = "w-3.5 h-3.5 shrink-0";
  switch (status) {
    case "running":
      return <Loader2 aria-hidden="true" className={`${className} animate-spin text-[var(--primary-main)]`} />;
    case "done":
      return <CheckCircle2 aria-hidden="true" className={`${className} text-emerald-400`} />;
    case "error":
      return <CircleAlert aria-hidden="true" className={`${className} text-red-400`} />;
    default:
      return <CircleDashed aria-hidden="true" className={`${className} text-[var(--text-muted)]`} />;
  }
}

function ToolCallEntry({ call }: { call: ToolCallView }) {
  const { t } = useTranslation();
  const hasArguments = Object.keys(call.arguments).length > 0;

  return (
    <details className="group rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-canvas)] text-xs">
      <summary className="flex items-center gap-2 px-3 py-1.5 cursor-pointer list-none min-w-0">
        <ChevronRight aria-hidden="true" className="w-3.5 h-3.5 shrink-0 text-[var(--text-muted)] transition-transform group-open:rotate-90" />
        <Wrench aria-hidden="true" className="w-3.5 h-3.5 shrink-0 text-[var(--text-muted)]" />
        <span className="font-mono text-[var(--text-main)] truncate min-w-0 flex-1">
          {call.name || t("Chat.toolUnknown")}
        </span>
        <span className="flex items-center gap-1 shrink-0 text-[var(--text-muted)]">
          <StatusIcon status={call.status} />
          {t(STATUS_KEYS[call.status])}
        </span>
      </summary>
      <div className="px-3 pb-2 space-y-2 min-w-0">
        <div>
          <p className="font-semibold text-[var(--text-muted)] mb-0.5">{t("Chat.toolArguments")}</p>
          {hasArguments ? (
            <pre className="whitespace-pre-wrap break-words [overflow-wrap:anywhere] font-mono text-[11px] text-[var(--text-main)] max-h-48 overflow-y-auto">
              {formatToolArguments(call.arguments)}
            </pre>
          ) : (
            <p className="text-[var(--text-muted)]">{t("Chat.toolNoArguments")}</p>
          )}
        </div>
        {call.result !== undefined && (
          <div>
            <p className="font-semibold text-[var(--text-muted)] mb-0.5">{t("Chat.toolResult")}</p>
            <pre className="whitespace-pre-wrap break-words [overflow-wrap:anywhere] font-mono text-[11px] text-[var(--text-main)] max-h-48 overflow-y-auto">
              {redactText(call.result)}
            </pre>
          </div>
        )}
      </div>
    </details>
  );
}

interface ToolCallGroupProps {
  calls: ToolCallView[];
}

/** Compact list of the tools ALFI used in one turn; details are collapsed by default. */
export function ToolCallGroup({ calls }: ToolCallGroupProps) {
  const { t } = useTranslation();
  if (calls.length === 0) return null;

  return (
    <div className="flex w-full justify-start pl-11">
      <div className="w-full max-w-3xl min-w-0 space-y-1" role="group" aria-label={t("Chat.toolCallsTitle", { count: calls.length })}>
        {calls.map((call, index) => (
          <ToolCallEntry key={call.id || `${call.name}-${index}`} call={call} />
        ))}
      </div>
    </div>
  );
}
