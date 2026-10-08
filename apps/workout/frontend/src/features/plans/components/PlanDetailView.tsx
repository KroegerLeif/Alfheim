"use client";

import { useState } from "react";
import { Button, EmptyState, Skeleton, Spinner, useTranslation } from "@alfheim/shared";
import { Calendar, Trash2 } from "lucide-react";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { InlineError } from "@/components/shared/InlineError";
import { describeError } from "@/core/errors";
import { useExerciseList } from "@/features/exercises";
import { Link, useRouter } from "@/navigation";
import { useDeletePlan, usePlan, useUpdatePlan } from "../hooks/usePlans";
import type { PlanCreate } from "../types";
import { PlanEditor } from "./PlanEditor";

interface PlanDetailViewProps {
  planId: string;
}

/** Edit / delete view of one plan. Save and delete failures are shown inline. */
export function PlanDetailView({ planId }: PlanDetailViewProps) {
  const { t } = useTranslation();
  const router = useRouter();

  const { data: plan, isLoading: planLoading, isError } = usePlan(planId);
  const { data: exercises, isLoading: exercisesLoading } = useExerciseList();

  const updatePlanMutation = useUpdatePlan(planId);
  const deletePlanMutation = useDeletePlan();

  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const handleSave = async (payload: PlanCreate) => {
    setActionError(null);
    try {
      await updatePlanMutation.mutateAsync({
        name: payload.name,
        description: payload.description,
        is_shared: payload.is_shared,
        days: payload.days,
      });
      router.push("/plans");
    } catch (err) {
      setActionError(describeError(err, t, "workout.planSaveFailed"));
    }
  };

  const handleDelete = async () => {
    setActionError(null);
    try {
      await deletePlanMutation.mutateAsync(planId);
      router.push("/plans");
    } catch (err) {
      setIsConfirmOpen(false);
      setActionError(describeError(err, t, "workout.planDeleteFailed"));
    }
  };

  if (planLoading || exercisesLoading) {
    return (
      <div className="space-y-4">
        <Spinner label={t("workout.loading")} className="mx-auto" />
        <Skeleton className="h-64 w-full rounded-xl" />
      </div>
    );
  }

  if (isError || !plan) {
    return (
      <EmptyState
        icon={<Calendar className="h-8 w-8" />}
        title={t("workout.noPlans")}
        description={t("workout.loadFailed")}
        action={
          <Button asChild size="sm">
            <Link href="/plans">{t("workout.plansTitle")}</Link>
          </Button>
        }
      />
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <header className="min-w-0">
          <h1 className="font-heading text-2xl font-black uppercase tracking-wide md:text-3xl">
            {t("workout.editPlan")}
          </h1>
          <p className="mt-1 break-words font-mono text-[10px] uppercase tracking-widest text-[var(--text-muted)]">
            {plan.name}
          </p>
        </header>

        <Button
          variant="outline"
          onClick={() => setIsConfirmOpen(true)}
          disabled={deletePlanMutation.isPending}
          className="text-red-400 hover:bg-red-950/20 hover:text-red-300"
        >
          <Trash2 className="mr-1.5 h-4 w-4" aria-hidden="true" />
          {t("workout.deletePlan")}
        </Button>
      </div>

      <PlanEditor
        initialPlan={plan}
        availableExercises={exercises ?? []}
        onSave={handleSave}
        onCancel={() => router.push("/plans")}
        isSaving={updatePlanMutation.isPending || deletePlanMutation.isPending}
        errorMessage={actionError}
      />

      <ConfirmDialog
        open={isConfirmOpen}
        onOpenChange={setIsConfirmOpen}
        title={t("workout.deletePlan")}
        description={t("workout.planDeleteConfirm", { name: plan.name })}
        confirmLabel={t("workout.deletePlan")}
        isPending={deletePlanMutation.isPending}
        onConfirm={() => void handleDelete()}
      />
    </div>
  );
}
