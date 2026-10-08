"use client";

import { useState } from "react";
import { Button, Field, Input, Select, useTranslation } from "@alfheim/shared";
import { Plus, Trash2 } from "lucide-react";
import { MUSCLE_GROUP_LABEL_KEYS, type ExerciseRead } from "@/features/exercises";
import type { PlanDayRead, PlanSetCreate } from "../types";
import { PlanExerciseRow } from "./PlanExerciseRow";

interface PlanDayBuilderProps {
  day: PlanDayRead;
  availableExercises: ExerciseRead[];
  onUpdateLabel: (label: string) => void;
  onDeleteDay: () => void;
  onAddExercise: (exerciseId: string) => void;
  onRemoveExercise: (exerciseIndex: number) => void;
  onAddSet: (exerciseIndex: number) => void;
  onUpdateSet: (exerciseIndex: number, setIndex: number, patch: Partial<PlanSetCreate>) => void;
  onRemoveSet: (exerciseIndex: number, setIndex: number) => void;
}

export function PlanDayBuilder({
  day,
  availableExercises,
  onUpdateLabel,
  onDeleteDay,
  onAddExercise,
  onRemoveExercise,
  onAddSet,
  onUpdateSet,
  onRemoveSet,
}: PlanDayBuilderProps) {
  const { t } = useTranslation();
  const [selectedExerciseId, setSelectedExerciseId] = useState("");

  const handleAddSelectedExercise = () => {
    if (!selectedExerciseId) return;
    onAddExercise(selectedExerciseId);
    setSelectedExerciseId("");
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-[var(--surface-elevated)] p-4">
        <Field htmlFor="plan-day-label" label={t("workout.dayLabel")} className="min-w-0 flex-1 basis-48">
          <Input
            id="plan-day-label"
            value={day.label}
            maxLength={100}
            onChange={(e) => onUpdateLabel(e.target.value)}
            placeholder={t("workout.dayLabelPlaceholder")}
            className="font-bold text-sm"
          />
        </Field>

        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={onDeleteDay}
          className="text-red-400 hover:text-red-300 hover:bg-red-950/20 self-end"
        >
          <Trash2 className="h-4 w-4 mr-1" />
          {t("workout.deleteDay")}
        </Button>
      </div>

      <div className="space-y-3">
        {day.exercises.length === 0 ? (
          <div className="rounded-lg border border-dashed border-[var(--border-subtle)] p-8 text-center text-xs text-[var(--text-muted)]">
            {t("workout.noExercises")}
          </div>
        ) : (
          day.exercises.map((exercise, exIndex) => (
            <PlanExerciseRow
              key={exercise.id || exIndex}
              exercise={exercise}
              availableExercises={availableExercises}
              onRemoveExercise={() => onRemoveExercise(exIndex)}
              onAddSet={() => onAddSet(exIndex)}
              onUpdateSet={(setIndex, patch) => onUpdateSet(exIndex, setIndex, patch)}
              onRemoveSet={(setIndex) => onRemoveSet(exIndex, setIndex)}
            />
          ))
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2 rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-base)] p-3">
        <Select
          value={selectedExerciseId}
          onChange={(e) => setSelectedExerciseId(e.target.value)}
          aria-label={t("workout.addExercise")}
          placeholder={`-- ${t("workout.addExercise")} --`}
          options={availableExercises.map((ex) => ({
            value: ex.id,
            label: `${ex.name} (${t(MUSCLE_GROUP_LABEL_KEYS[ex.primary_muscle])})`,
          }))}
          className="min-w-0 flex-1 text-xs"
        />

        <Button
          type="button"
          size="sm"
          disabled={!selectedExerciseId}
          onClick={handleAddSelectedExercise}
          className="text-xs"
        >
          <Plus className="h-4 w-4 mr-1" />
          {t("workout.addExercise")}
        </Button>
      </div>
    </div>
  );
}
