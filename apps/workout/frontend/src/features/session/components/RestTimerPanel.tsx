"use client";

import { Button, useTranslation } from "@alfheim/shared";
import { SkipForward, Timer } from "lucide-react";
import { formatDuration } from "@/core/utils";

interface RestTimerPanelProps {
  secondsRemaining: number | null;
  onSkip: () => void;
}

/**
 * Rest countdown. Renders nothing when no rest period is running, so the HUD
 * stays uncluttered between exercises.
 */
export function RestTimerPanel({ secondsRemaining, onSkip }: RestTimerPanelProps) {
  const { t } = useTranslation();

  if (secondsRemaining === null) return null;

  return (
    <div
      role="timer"
      aria-live="off"
      className="flex items-center justify-between gap-4 rounded-lg border border-[var(--border-accent)] bg-[var(--surface-elevated)] px-4 py-3"
    >
      <div className="flex items-center gap-3">
        <Timer className="h-5 w-5 text-[var(--primary-main)]" aria-hidden="true" />
        <div>
          <span className="block text-[10px] font-bold uppercase tracking-widest text-[var(--text-muted)]">
            {t("workout.restTimer")}
          </span>
          <span className="font-mono text-2xl font-black tabular-nums text-[var(--text-main)]">
            {formatDuration(secondsRemaining)}
          </span>
        </div>
      </div>

      <Button variant="ghost" className="min-h-11" onClick={onSkip}>
        <SkipForward aria-hidden="true" />
        {t("workout.skipRest")}
      </Button>
    </div>
  );
}
