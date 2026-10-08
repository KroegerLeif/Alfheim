"use client";

import { useState } from "react";
import { Button, Card, CardContent, EmptyState, Spinner, useTranslation } from "@alfheim/shared";
import { Ban, Play, Zap } from "lucide-react";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { InlineError } from "@/components/shared/InlineError";
import { describeError } from "@/core/errors";
import { useRouter } from "@/navigation";
import { useAbandonSessionFlow } from "../hooks/useAbandonSessionFlow";
import { useActiveSession, useStartSession } from "../hooks/useSessions";

/**
 * Landing surface: resume the in-progress session, abandon a stuck one, or
 * start a new one. Starting a plan day lives on the plan cards; this offers
 * the freeform start so a workout can always begin in one tap.
 */
export function TodayView() {
  const { t } = useTranslation();
  const router = useRouter();
  const { activeSession, isLoading, isError } = useActiveSession();
  const startMutation = useStartSession();
  const { abandonSession, isAbandoning } = useAbandonSessionFlow();
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const handleStart = async () => {
    setActionError(null);
    try {
      const session = await startMutation.mutateAsync({});
      router.push(`/session/${session.id}`);
    } catch (err) {
      setActionError(describeError(err, t, "workout.startFailed"));
    }
  };

  const handleAbandon = async () => {
    if (!activeSession) return;
    setActionError(null);
    try {
      await abandonSession(activeSession.id);
    } catch (err) {
      setActionError(describeError(err, t, "workout.abandonFailed"));
    } finally {
      setIsConfirmOpen(false);
    }
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

      <InlineError message={isError ? t("workout.loadFailed") : null} />
      <InlineError message={actionError} />

      {isLoading ? (
        <Spinner label={t("workout.loading")} className="mx-auto" />
      ) : activeSession ? (
        <Card className="border-[var(--border-accent)]">
          <CardContent className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <span className="block font-mono text-[10px] uppercase tracking-widest text-[var(--text-muted)]">
                {t("workout.activeSession")}
              </span>
              <span className="line-clamp-2 break-words font-heading text-lg font-bold uppercase tracking-wide">
                {activeSession.plan_day_label ?? t("workout.sessionTitle")}
              </span>
            </div>
            <div className="flex shrink-0 flex-wrap gap-2">
              <Button
                variant="ghost"
                className="min-h-11 text-red-400 hover:bg-red-950/20 hover:text-red-300"
                disabled={isAbandoning}
                onClick={() => setIsConfirmOpen(true)}
              >
                <Ban aria-hidden="true" />
                {t("workout.abandonSession")}
              </Button>
              <Button className="min-h-11" onClick={() => router.push(`/session/${activeSession.id}`)}>
                <Play aria-hidden="true" />
                {t("workout.resumeSession")}
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <EmptyState
          icon={<Zap className="h-8 w-8" />}
          title={t("workout.noActiveSession")}
          description={t("workout.noActiveSessionSubtitle")}
          action={
            <Button className="min-h-11" disabled={startMutation.isPending} onClick={() => void handleStart()}>
              <Play aria-hidden="true" />
              {t("workout.startFreeSession")}
            </Button>
          }
        />
      )}

      <ConfirmDialog
        open={isConfirmOpen}
        onOpenChange={setIsConfirmOpen}
        title={t("workout.abandonSession")}
        description={t("workout.abandonConfirm")}
        confirmLabel={t("workout.abandonSession")}
        isPending={isAbandoning}
        onConfirm={() => void handleAbandon()}
      />
    </div>
  );
}
