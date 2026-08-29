"use client";

import { Button, Card, CardContent, EmptyState, Spinner, useTranslation } from "@alfheim/shared";
import { Play, Zap } from "lucide-react";
import { useRouter } from "@/navigation";
import { useActiveSession, useStartSession } from "../hooks/useSessions";

/**
 * Landing surface: resume the in-progress session, or start a new one.
 * Plan-day selection is deferred to the plans slice; this offers the freeform
 * start so a workout can always begin in one tap.
 */
export function TodayView() {
  const { t } = useTranslation();
  const router = useRouter();
  const { activeSession, isLoading, isError } = useActiveSession();
  const startMutation = useStartSession();

  const handleStart = () => {
    startMutation.mutate(
      {},
      { onSuccess: (session) => router.push(`/session/${session.id}`) }
    );
  };

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-heading text-2xl font-black uppercase tracking-wide md:text-3xl">
          {t("workout.todayTitle")}
        </h1>
        <p className="mt-1 font-mono text-[10px] uppercase tracking-widest text-[var(--text-muted)]">
          {t("workout.todaySubtitle")}
        </p>
      </header>

      {isError && (
        <div
          role="alert"
          className="rounded-lg border border-red-800/40 bg-red-950/20 p-4 text-xs font-bold uppercase text-red-400"
        >
          {t("workout.loadFailed")}
        </div>
      )}

      {isLoading ? (
        <Spinner label={t("workout.loading")} className="mx-auto" />
      ) : activeSession ? (
        <Card className="border-[var(--border-accent)]">
          <CardContent className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <span className="block font-mono text-[10px] uppercase tracking-widest text-[var(--text-muted)]">
                {t("workout.activeSession")}
              </span>
              <span className="truncate font-heading text-lg font-bold uppercase tracking-wide">
                {activeSession.plan_day_label ?? t("workout.sessionTitle")}
              </span>
            </div>
            <Button
              className="min-h-11 shrink-0"
              onClick={() => router.push(`/session/${activeSession.id}`)}
            >
              <Play aria-hidden="true" />
              {t("workout.resumeSession")}
            </Button>
          </CardContent>
        </Card>
      ) : (
        <EmptyState
          icon={<Zap className="h-8 w-8" />}
          title={t("workout.noActiveSession")}
          description={t("workout.noActiveSessionSubtitle")}
          action={
            <Button className="min-h-11" disabled={startMutation.isPending} onClick={handleStart}>
              <Play aria-hidden="true" />
              {t("workout.startFreeSession")}
            </Button>
          }
        />
      )}
    </div>
  );
}
