"use client";

import { Button, Checkbox, Input, Textarea, useTranslation } from "@alfheim/shared";
import { Plus, Save, X } from "lucide-react";
import type { ExerciseRead } from "@/features/exercises/types";
import type { PlanCreate, PlanRead } from "../types";
import { usePlanEditorState } from "../hooks/usePlanEditorState";
import { PlanDayBuilder } from "./PlanDayBuilder";

interface PlanEditorProps {
  initialPlan?: PlanRead;
  availableExercises: ExerciseRead[];
  onSave: (payload: PlanCreate) => Promise<void>;
  onCancel: () => void;
  isSaving?: boolean;
}

export function PlanEditor({
  initialPlan,
  availableExercises,
  onSave,
  onCancel,
  isSaving,
}: PlanEditorProps) {
  const { t } = useTranslation();
  const state = usePlanEditorState(initialPlan);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!state.name.trim()) {
      state.setNameError(t("workout.planNameRequired"));
      return;
    }
    await onSave(state.buildPayload());
  };

  const currentDay = state.days[state.activeDayIndex] || state.days[0];

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-base)] p-6 space-y-4">
        <div>
          <label className="block text-xs font-mono uppercase tracking-wider text-[var(--text-muted)] mb-1">
            {t("workout.planName")} *
          </label>
          <Input
            value={state.name}
            onChange={(e) => {
              state.setName(e.target.value);
              if (state.nameError) state.setNameError(null);
            }}
            placeholder={t("workout.planNamePlaceholder")}
            required
            className="text-base font-bold"
          />
          {state.nameError && <p className="mt-1 text-xs text-red-400">{state.nameError}</p>}
        </div>

        <div>
          <label className="block text-xs font-mono uppercase tracking-wider text-[var(--text-muted)] mb-1">
            {t("workout.planDescription")}
          </label>
          <Textarea
            value={state.description}
            onChange={(e) => state.setDescription(e.target.value)}
            placeholder="..."
            rows={2}
            className="text-xs"
          />
        </div>

        <label className="flex items-center gap-2 cursor-pointer select-none text-xs text-[var(--text-primary)]">
          <Checkbox
            checked={state.isShared}
            onChange={(e) => state.setIsShared(e.target.checked)}
          />
          {t("workout.sharedPlan")}
        </label>
      </div>

      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-2 border-b border-[var(--border-subtle)] pb-2">
          {state.days.map((day, idx) => (
            <button
              key={day.id || idx}
              type="button"
              onClick={() => state.setActiveDayIndex(idx)}
              className={`rounded-lg px-4 py-2 text-xs font-bold transition-all ${
                state.activeDayIndex === idx
                  ? "bg-[var(--primary-main)] text-white"
                  : "bg-[var(--surface-elevated)] text-[var(--text-muted)] hover:text-[var(--text-primary)]"
              }`}
            >
              {day.label || `Tag ${idx + 1}`}
            </button>
          ))}

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={state.addDay}
            className="text-xs border-dashed"
          >
            <Plus className="h-3.5 w-3.5 mr-1" />
            {t("workout.addDay")}
          </Button>
        </div>

        {currentDay && (
          <PlanDayBuilder
            day={currentDay}
            availableExercises={availableExercises}
            onUpdateLabel={(label) => state.updateDayLabel(state.activeDayIndex, label)}
            onDeleteDay={() => state.deleteDay(state.activeDayIndex)}
            onAddExercise={(exerciseId) => state.addExercise(state.activeDayIndex, exerciseId)}
            onRemoveExercise={(exerciseIndex) =>
              state.removeExercise(state.activeDayIndex, exerciseIndex)
            }
            onAddSet={(exerciseIndex) => state.addSet(state.activeDayIndex, exerciseIndex)}
            onUpdateSet={(exerciseIndex, setIndex, patch) =>
              state.updateSet(state.activeDayIndex, exerciseIndex, setIndex, patch)
            }
            onRemoveSet={(exerciseIndex, setIndex) =>
              state.removeSet(state.activeDayIndex, exerciseIndex, setIndex)
            }
          />
        )}
      </div>

      <div className="flex items-center justify-end gap-3 pt-4 border-t border-[var(--border-subtle)]">
        <Button type="button" variant="outline" onClick={onCancel} disabled={isSaving}>
          <X className="h-4 w-4 mr-1.5" />
          {t("workout.cancel")}
        </Button>
        <Button type="submit" disabled={isSaving}>
          <Save className="h-4 w-4 mr-1.5" />
          {t("workout.save")}
        </Button>
      </div>
    </form>
  );
}
