"use client";

import { useState } from "react";
import { Button, EmptyState, Skeleton, Spinner, useTranslation } from "@alfheim/shared";
import { Calendar, Plus } from "lucide-react";
import { InlineError } from "@/components/shared/InlineError";
import { describeError } from "@/core/errors";
import { useExerciseList } from "@/features/exercises";
import { useStartSession } from "@/features/session";
import { useRouter } from "@/navigation";
import { useCreatePlan, usePlans } from "../hooks/usePlans";
import type { PlanCreate } from "../types";
import { PlanCard } from "./PlanCard";
import { PlanEditor } from "./PlanEditor";

export function PlanListView() {
  const { t } = useTranslation();
  const router = useRouter();

  const [isCreating, setIsCreating] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const { data: plans, isLoading: plansLoading, isError } = usePlans();
  const { data: exercises, isLoading: exercisesLoading } = useExerciseList();

  const createPlanMutation = useCreatePlan();
  const startSessionMutation = useStartSession();

  const planList = plans ?? [];

  const handleStartSession = async (planId: string, dayId: string) => {
    setActionError(null);
    try {
      const session = await startSessionMutation.mutateAsync({
        plan_id: planId,
        plan_day_id: dayId,
      });
      router.push(`/session/${session.id}`);
    } catch (err) {
      setActionError(describeError(err, t, "workout.startFailed"));
    }
  };

  const handleCreatePlan = async (payload: PlanCreate) => {
    setActionError(null);
    try {
      await createPlanMutation.mutateAsync(payload);
      setIsCreating(false);
    } catch (err) {
      setActionError(describeError(err, t, "workout.planSaveFailed"));
    }
  };

  const closeEditor = () => {
    setActionError(null);
    setIsCreating(false);
  };

  if (isCreating) {
    return (
      <div className="space-y-6">
        <header>
          <h1 className="font-heading text-2xl font-black uppercase tracking-wide md:text-3xl">
            {t("workout.createPlan")}
          </h1>
        </header>

        <PlanEditor
          availableExercises={exercises ?? []}
          onSave={handleCreatePlan}
          onCancel={closeEditor}
          isSaving={createPlanMutation.isPending}
          errorMessage={actionError}
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <header className="min-w-0">
          <h1 className="font-heading text-2xl font-black uppercase tracking-wide md:text-3xl">
            {t("workout.plansTitle")}
          </h1>
          <p className="mt-1 font-mono text-[10px] uppercase tracking-widest text-[var(--text-muted)]">
            {t("workout.plansSubtitle")}
          </p>
        </header>

        <Button onClick={() => setIsCreating(true)}>
          <Plus className="mr-1.5 h-4 w-4" aria-hidden="true" />
          {t("workout.createPlan")}
        </Button>
      </div>

      <InlineError message={isError ? t("workout.loadFailed") : null} />
      <InlineError message={actionError} />

      {plansLoading || exercisesLoading ? (
        <div className="space-y-4">
          <Spinner label={t("workout.loading")} className="mx-auto" />
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            {[0, 1, 2].map((idx) => (
              <Skeleton key={idx} className="h-48 w-full rounded-xl" />
            ))}
          </div>
        </div>
      ) : planList.length === 0 ? (
        <EmptyState
          icon={<Calendar className="h-8 w-8" />}
          title={t("workout.noPlans")}
          description={t("workout.noPlansSubtitle")}
          action={
            <Button onClick={() => setIsCreating(true)} size="sm">
              <Plus className="mr-1.5 h-4 w-4" aria-hidden="true" />
              {t("workout.createPlan")}
            </Button>
          }
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {planList.map((plan) => (
            <PlanCard
              key={plan.id}
              plan={plan}
              onStartSession={handleStartSession}
              isStarting={startSessionMutation.isPending}
            />
          ))}
        </div>
      )}
    </div>
  );
}
