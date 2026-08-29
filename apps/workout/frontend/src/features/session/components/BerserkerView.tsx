"use client";

import { Button, EmptyState, Spinner, useTranslation } from "@alfheim/shared";
import { Flag, Zap } from "lucide-react";
import { SyncStatusBadge } from "@/features/offline_sync";
import { useBerserkerSession } from "../hooks/useBerserkerSession";
import { ActiveSetPanel } from "./ActiveSetPanel";
import { RestTimerPanel } from "./RestTimerPanel";
import { SessionProgressList } from "./SessionProgressList";

interface BerserkerViewProps {
  sessionId: string;
}

/**
 * Live workout execution HUD.
 *
 * One route for both form factors: below md this is a single-column,
 * thumb-reachable surface; from md up the active set and the session overview
 * sit side by side.
 */
export function BerserkerView({ sessionId }: BerserkerViewProps) {
  const { t } = useTranslation();
  const {
    session,
    exercises,
    cursor,
    isSessionFinished,
    isLoading,
    isError,
    isLogging,
    logActiveSet,
    finishSession,
    isFinishing,
    restTimer,
    syncQueue,
  } = useBerserkerSession(sessionId);

  if (isLoading) {
    return <Spinner size="lg" label={t("workout.loading")} className="mx-auto mt-12" />;
  }

  if (isError || !session) {
    return (
      <div
        role="alert"
        className="rounded-lg border border-red-800/40 bg-red-950/20 p-4 text-xs font-bold uppercase text-red-400"
      >
        {t("workout.loadFailed")}
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="truncate font-heading text-xl font-black uppercase tracking-wide md:text-2xl">
            {session.plan_day_label ?? t("workout.sessionTitle")}
          </h1>
          <p className="font-mono text-[10px] uppercase tracking-widest text-[var(--text-muted)]">
            {t("workout.sessionSubtitle")}
          </p>
        </div>
        <SyncStatusBadge
          pendingCount={syncQueue.pendingCount}
          isSyncing={syncQueue.isSyncing}
          isOnline={syncQueue.isOnline}
          lastError={syncQueue.lastError}
          onRetry={syncQueue.flushNow}
        />
      </header>

      <RestTimerPanel secondsRemaining={restTimer.secondsRemaining} onSkip={restTimer.skip} />

      <div className="grid grid-cols-1 gap-5 md:grid-cols-5">
        <div className="md:col-span-3">
          {cursor.exercise && cursor.set ? (
            <ActiveSetPanel
              exercise={cursor.exercise}
              set={cursor.set}
              setIndex={cursor.setIndex}
              onLog={logActiveSet}
              isLogging={isLogging}
            />
          ) : (
            <EmptyState
              icon={<Zap className="h-8 w-8" />}
              title={
                isSessionFinished ? t("workout.sessionComplete") : t("workout.noActiveSession")
              }
              description={isSessionFinished ? undefined : t("workout.noActiveSessionSubtitle")}
            />
          )}
        </div>

        <div className="space-y-4 md:col-span-2">
          <SessionProgressList exercises={exercises} activeExerciseId={cursor.exercise?.id ?? null} />

          <Button
            type="button"
            variant="outline"
            className="min-h-11 w-full"
            disabled={isFinishing}
            onClick={finishSession}
          >
            <Flag aria-hidden="true" />
            {t("workout.finishSession")}
          </Button>
        </div>
      </div>
    </div>
  );
}
