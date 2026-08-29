"use client";

import { use, useState } from "react";
import { Button, EmptyState, Skeleton, Spinner, useTranslation } from "@alfheim/shared";
import { Calendar, Trash2 } from "lucide-react";
import { Link, useRouter } from "@/navigation";
import { useExerciseList } from "@/features/exercises/hooks/useExercises";
import {
  PlanEditor,
  useDeletePlan,
  usePlan,
  useUpdatePlan,
  type PlanCreate,
} from "@/features/plans";

export default function PlanDetailPage({
  params,
}: {
  params: Promise<{ planId: string }>;
}) {
  const { planId } = use(params);
  const { t } = useTranslation();
  const router = useRouter();

  const { data: plan, isLoading: planLoading, isError } = usePlan(planId);
  const { data: exercises, isLoading: exercisesLoading } = useExerciseList();

  const updatePlanMutation = useUpdatePlan(planId);
  const deletePlanMutation = useDeletePlan();

  const [isDeleting, setIsDeleting] = useState(false);

  const handleSave = async (payload: PlanCreate) => {
    try {
      await updatePlanMutation.mutateAsync({
        name: payload.name,
        description: payload.description,
        is_shared: payload.is_shared,
        days: payload.days,
      });
      router.push("/plans");
    } catch (err) {
      console.error("Failed to update plan:", err);
    }
  };

  const handleDelete = async () => {
    if (!plan) return;
    if (window.confirm(t("workout.planDeleteConfirm", { name: plan.name }))) {
      try {
        setIsDeleting(true);
        await deletePlanMutation.mutateAsync(planId);
        router.push("/plans");
      } catch (err) {
        console.error("Failed to delete plan:", err);
        setIsDeleting(false);
      }
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
        <header>
          <h1 className="font-heading text-2xl font-black uppercase tracking-wide md:text-3xl">
            {t("workout.editPlan")}
          </h1>
          <p className="mt-1 font-mono text-[10px] uppercase tracking-widest text-[var(--text-muted)]">
            {plan.name}
          </p>
        </header>

        <Button
          variant="outline"
          onClick={handleDelete}
          disabled={isDeleting}
          className="text-red-400 hover:text-red-300 hover:bg-red-950/20"
        >
          <Trash2 className="h-4 w-4 mr-1.5" />
          {t("workout.deletePlan")}
        </Button>
      </div>

      <PlanEditor
        initialPlan={plan}
        availableExercises={exercises ?? []}
        onSave={handleSave}
        onCancel={() => router.push("/plans")}
        isSaving={updatePlanMutation.isPending || isDeleting}
      />
    </div>
  );
}
