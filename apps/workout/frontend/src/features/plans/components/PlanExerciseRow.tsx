"use client";

import { Button, Checkbox, Input, Select, useTranslation } from "@alfheim/shared";
import { Plus, Trash2 } from "lucide-react";
import type { ExerciseRead } from "@/features/exercises/types";
import type { PlanExerciseRead, PlanSetCreate, TargetWeightType } from "../types";

interface PlanExerciseRowProps {
  exercise: PlanExerciseRead;
  availableExercises: ExerciseRead[];
  onRemoveExercise: () => void;
  onAddSet: () => void;
  onUpdateSet: (index: number, patch: Partial<PlanSetCreate>) => void;
  onRemoveSet: (index: number) => void;
}

export function PlanExerciseRow({
  exercise,
  availableExercises,
  onRemoveExercise,
  onAddSet,
  onUpdateSet,
  onRemoveSet,
}: PlanExerciseRowProps) {
  const { t } = useTranslation();

  const foundExercise = availableExercises.find((e) => e.id === exercise.exercise_id);
  const exerciseName = foundExercise?.name ?? exercise.exercise_id;

  return (
    <div className="rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-elevated)] p-4 space-y-3">
      <div className="flex items-center justify-between gap-2 border-b border-[var(--border-subtle)] pb-2">
        <div>
          <h4 className="text-sm font-bold text-[var(--text-primary)]">{exerciseName}</h4>
          {foundExercise && (
            <p className="text-[10px] uppercase font-mono text-[var(--text-muted)]">
              {t(`workout.muscle${foundExercise.primary_muscle.charAt(0).toUpperCase() + foundExercise.primary_muscle.slice(1)}` as any)}
            </p>
          )}
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={onRemoveExercise}
          className="text-red-400 hover:text-red-300 hover:bg-red-950/20"
        >
          <Trash2 className="h-4 w-4 mr-1" />
          {t("workout.removeExercise")}
        </Button>
      </div>

      <div className="space-y-2">
        {exercise.sets.map((set, setIndex) => (
          <div
            key={set.id || setIndex}
            className="flex flex-wrap items-center gap-2 rounded bg-[var(--surface-base)] p-2 text-xs"
          >
            <span className="font-mono font-bold w-12 text-[var(--text-muted)]">
              #{setIndex + 1}
            </span>

            <div className="flex items-center gap-1 w-24">
              <Input
                type="number"
                min="1"
                placeholder={t("workout.reps")}
                value={set.target_reps ?? ""}
                onChange={(e) =>
                  onUpdateSet(setIndex, {
                    target_reps: e.target.value ? parseInt(e.target.value, 10) : null,
                  })
                }
                className="h-8 text-xs"
              />
            </div>

            <div className="flex items-center gap-1 w-36">
              <Select
                value={set.target_weight_type}
                onChange={(e) => {
                  const val = e.target.value as TargetWeightType;
                  onUpdateSet(setIndex, {
                    target_weight_type: val,
                    target_weight_kg: val === "absolute" ? set.target_weight_kg ?? 50 : null,
                    offset_kg: val === "offset" ? set.offset_kg ?? 2.5 : null,
                  });
                }}
                options={[
                  { value: "default", label: t("workout.weightDefault") },
                  { value: "absolute", label: t("workout.weightAbsolute") },
                  { value: "offset", label: t("workout.weightOffset") },
                ]}
                className="h-8 text-xs"
              />
            </div>

            {set.target_weight_type === "absolute" && (
              <div className="flex items-center gap-1 w-24">
                <Input
                  type="number"
                  step="0.5"
                  placeholder={t("workout.weight")}
                  value={set.target_weight_kg ?? ""}
                  onChange={(e) =>
                    onUpdateSet(setIndex, {
                      target_weight_kg: e.target.value ? parseFloat(e.target.value) : null,
                    })
                  }
                  className="h-8 text-xs"
                />
                <span className="text-[10px] text-[var(--text-muted)]">kg</span>
              </div>
            )}

            {set.target_weight_type === "offset" && (
              <div className="flex items-center gap-1 w-24">
                <Input
                  type="number"
                  step="0.5"
                  placeholder="± kg"
                  value={set.offset_kg ?? ""}
                  onChange={(e) =>
                    onUpdateSet(setIndex, {
                      offset_kg: e.target.value ? parseFloat(e.target.value) : null,
                    })
                  }
                  className="h-8 text-xs"
                />
                <span className="text-[10px] text-[var(--text-muted)]">kg</span>
              </div>
            )}

            <div className="flex items-center gap-1.5 ml-auto">
              <label className="flex items-center gap-1 cursor-pointer select-none text-[11px] text-[var(--text-muted)]">
                <Checkbox
                  checked={set.is_warmup}
                  onChange={(e) =>
                    onUpdateSet(setIndex, { is_warmup: e.target.checked })
                  }
                />
                {t("workout.warmupSet")}
              </label>

              <Button
                variant="ghost"
                size="sm"
                onClick={() => onRemoveSet(setIndex)}
                className="h-7 w-7 p-0 text-[var(--text-muted)] hover:text-red-400"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        ))}
      </div>

      <Button
        variant="outline"
        size="sm"
        onClick={onAddSet}
        className="w-full text-xs border-dashed"
      >
        <Plus className="h-3.5 w-3.5 mr-1" />
        {t("workout.addSet")}
      </Button>
    </div>
  );
}
