"use client";

import { Button, EmptyState, Spinner, useTranslation } from "@alfheim/shared";
import { Home, Zap } from "lucide-react";
import { InlineError } from "@/components/shared/InlineError";
import { describeError } from "@/core/errors";
import { SyncStatusBadge } from "@/features/offline_sync";
import { Link, useRouter } from "@/navigation";
import { useBerserkerSession } from "../hooks/useBerserkerSession";
import { ActiveSetPanel } from "./ActiveSetPanel";
import { RestTimerPanel } from "./RestTimerPanel";
import { SessionActions } from "./SessionActions";
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
  const router = useRouter();
  const {
    session,
    exercises,
    cursor,
    isActive,
    isSessionFinished,
    isLoading,
    isError,
    isLogging,
    logError,
    logActiveSet,
    finishSession,
    isFinishing,
    abandonSession,
    isAbandoning,
    restTimer,
    syncQueue,
  } = useBerserkerSession(sessionId);

  if (isLoading) {
    return <Spinner size="lg" label={t("workout.loading")} className="mx-auto mt-12" />;
  }

  if (isError || !session) {
    return <InlineError message={t("workout.loadFailed")} />;
  }

  const emptyTitle = !isActive
    ? t(session.status === "abandoned" ? "workout.sessionAbandoned" : "workout.sessionComplete")
    : isSessionFinished
      ? t("workout.sessionComplete")
      : t("workout.noActiveSession");

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="line-clamp-2 break-words font-heading text-xl font-black uppercase tracking-wide md:text-2xl">
            {session.plan_day_label ?? t("workout.sessionTitle")}
          </h1>
          <p className="font-mono text-[10px] uppercase tracking-widest text-[var(--text-muted)]">
            {t("workout.sessionSubtitle")}
          </p>
        </div>
        {isActive && (
          <SyncStatusBadge
            pendingCount={syncQueue.pendingCount}
            isSyncing={syncQueue.isSyncing}
            isOnline={syncQueue.isOnline}
            lastError={syncQueue.lastError}
            droppedKeys={syncQueue.droppedKeys}
            onRetry={() => void syncQueue.flushNow()}
            onDismissDropped={syncQueue.dismissDropped}
          />
        )}
      </header>

      <InlineError message={logError ? describeError(logError, t, "workout.logFailed") : null} />

      <RestTimerPanel secondsRemaining={restTimer.secondsRemaining} onSkip={restTimer.skip} />

      <div className="grid grid-cols-1 gap-5 md:grid-cols-5">
        <div className="min-w-0 md:col-span-3">
          {cursor.exercise && cursor.set ? (
            <ActiveSetPanel
              key={cursor.set.id}
              exercise={cursor.exercise}
              set={cursor.set}
              setIndex={cursor.setIndex}
              onLog={logActiveSet}
              isLogging={isLogging}
            />
          ) : (
            <EmptyState
              icon={<Zap className="h-8 w-8" />}
              title={emptyTitle}
              description={isActive && !isSessionFinished ? t("workout.noActiveSessionSubtitle") : undefined}
              action={
                isActive ? undefined : (
                  <Button asChild className="min-h-11">
                    <Link href="/">
                      <Home aria-hidden="true" />
                      {t("workout.backToToday")}
                    </Link>
                  </Button>
                )
              }
            />
          )}
        </div>

        <div className="min-w-0 space-y-4 md:col-span-2">
          <SessionProgressList exercises={exercises} activeExerciseId={cursor.exercise?.id ?? null} />

          {isActive && (
            <SessionActions
              onFinish={finishSession}
              onAbandon={abandonSession}
              onClosed={() => router.push("/")}
              isFinishing={isFinishing}
              isAbandoning={isAbandoning}
            />
          )}
        </div>
      </div>
    </div>
  );
}
