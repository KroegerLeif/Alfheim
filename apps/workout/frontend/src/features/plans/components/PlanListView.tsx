"use client";

import { useState } from "react";
import { Button, EmptyState, Skeleton, Spinner, useTranslation } from "@alfheim/shared";
import { Calendar, Plus } from "lucide-react";
import { Link, useRouter } from "@/navigation";
import { useExerciseList } from "@/features/exercises/hooks/useExercises";
import { useStartSession } from "@/features/session/hooks/useSessions";
import { useCreatePlan, usePlans } from "../hooks/usePlans";
import type { PlanCreate } from "../types";
import { PlanCard } from "./PlanCard";
import { PlanEditor } from "./PlanEditor";

export function PlanListView() {
  const { t } = useTranslation();
  const router = useRouter();

  const [isCreating, setIsCreating] = useState(false);

  const { data: plans, isLoading: plansLoading, isError } = usePlans();
  const { data: exercises, isLoading: exercisesLoading } = useExerciseList();

  const createPlanMutation = useCreatePlan();
  const startSessionMutation = useStartSession();

  const handleStartSession = async (planId: string, dayId: string) => {
    try {
      const session = await startSessionMutation.mutateAsync({
        plan_id: planId,
        plan_day_id: dayId,
      });
      router.push(`/session/${session.id}`);
    } catch (err) {
      console.error("Failed to start session:", err);
    }
  };

  const handleCreatePlan = async (payload: PlanCreate) => {
    try {
      await createPlanMutation.mutateAsync(payload);
      setIsCreating(false);
    } catch (err) {
      console.error("Failed to create plan:", err);
    }
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
          onCancel={() => setIsCreating(false)}
          isSaving={createPlanMutation.isPending}
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <header>
          <h1 className="font-heading text-2xl font-black uppercase tracking-wide md:text-3xl">
            {t("workout.plansTitle")}
          </h1>
          <p className="mt-1 font-mono text-[10px] uppercase tracking-widest text-[var(--text-muted)]">
            {t("workout.plansSubtitle")}
          </p>
        </header>

        <Button onClick={() => setIsCreating(true)}>
          <Plus className="h-4 w-4 mr-1.5" />
          {t("workout.createPlan")}
        </Button>
      </div>

      {isError && (
        <div
          role="alert"
          className="rounded-lg border border-red-800/40 bg-red-950/20 p-4 text-xs font-bold uppercase text-red-400"
        >
          {t("workout.loadFailed")}
        </div>
      )}

      {plansLoading || exercisesLoading ? (
        <div className="space-y-4">
          <Spinner label={t("workout.loading")} className="mx-auto" />
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            {[0, 1, 2].map((idx) => (
              <Skeleton key={idx} className="h-48 w-full rounded-xl" />
            ))}
          </div>
        </div>
      ) : !plans || plans.length === 0 ? (
        <EmptyState
          icon={<Calendar className="h-8 w-8" />}
          title={t("workout.noPlans")}
          description={t("workout.noPlansSubtitle")}
          action={
            <Button onClick={() => setIsCreating(true)} size="sm">
              <Plus className="h-4 w-4 mr-1.5" />
              {t("workout.createPlan")}
            </Button>
          }
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {plans.map((plan) => (
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
