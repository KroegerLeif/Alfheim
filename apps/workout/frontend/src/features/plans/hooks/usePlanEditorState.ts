"use client";

import { useState } from "react";
import type { PlanCreate, PlanDayRead, PlanRead, PlanSetCreate } from "../types";

export function usePlanEditorState(initialPlan?: PlanRead) {
  const [name, setName] = useState(initialPlan?.name ?? "");
  const [description, setDescription] = useState(initialPlan?.description ?? "");
  const [isShared, setIsShared] = useState(initialPlan?.is_shared ?? false);
  const [days, setDays] = useState<PlanDayRead[]>(
    initialPlan?.days && initialPlan.days.length > 0
      ? initialPlan.days
      : [
          {
            id: `temp-day-${Date.now()}`,
            day_order: 1,
            label: "Tag 1",
            exercises: [],
          },
        ]
  );
  const [activeDayIndex, setActiveDayIndex] = useState(0);
  const [nameError, setNameError] = useState<string | null>(null);

  const addDay = () => {
    const newDayIndex = days.length + 1;
    const newDay: PlanDayRead = {
      id: `temp-day-${Date.now()}`,
      day_order: newDayIndex,
      label: `Tag ${newDayIndex}`,
      exercises: [],
    };
    setDays([...days, newDay]);
    setActiveDayIndex(days.length);
  };

  const deleteDay = (dayIndex: number) => {
    if (days.length <= 1) return;
    const updated = days.filter((_, idx) => idx !== dayIndex);
    setDays(updated);
    setActiveDayIndex(Math.max(0, dayIndex - 1));
  };

  const updateDayLabel = (dayIndex: number, label: string) => {
    const updated = [...days];
    updated[dayIndex] = { ...updated[dayIndex], label };
    setDays(updated);
  };

  const addExercise = (dayIndex: number, exerciseId: string) => {
    const updated = [...days];
    const targetDay = updated[dayIndex];
    const newExercise = {
      id: `temp-ex-${Date.now()}`,
      exercise_id: exerciseId,
      exercise_order: targetDay.exercises.length + 1,
      sets: [
        {
          id: `temp-set-${Date.now()}`,
          set_order: 1,
          target_reps: 10,
          target_weight_type: "default" as const,
          target_weight_kg: null,
          offset_kg: null,
          is_warmup: false,
        },
      ],
    };
    targetDay.exercises = [...targetDay.exercises, newExercise];
    setDays(updated);
  };

  const removeExercise = (dayIndex: number, exerciseIndex: number) => {
    const updated = [...days];
    const targetDay = updated[dayIndex];
    targetDay.exercises = targetDay.exercises.filter((_, idx) => idx !== exerciseIndex);
    setDays(updated);
  };

  const addSet = (dayIndex: number, exerciseIndex: number) => {
    const updated = [...days];
    const targetEx = updated[dayIndex].exercises[exerciseIndex];
    const lastSet = targetEx.sets[targetEx.sets.length - 1];
    const newSet = {
      id: `temp-set-${Date.now()}-${targetEx.sets.length + 1}`,
      set_order: targetEx.sets.length + 1,
      target_reps: lastSet?.target_reps ?? 10,
      target_weight_type: lastSet?.target_weight_type ?? "default",
      target_weight_kg: lastSet?.target_weight_kg ?? null,
      offset_kg: lastSet?.offset_kg ?? null,
      is_warmup: false,
    };
    targetEx.sets = [...targetEx.sets, newSet];
    setDays(updated);
  };

  const updateSet = (
    dayIndex: number,
    exerciseIndex: number,
    setIndex: number,
    patch: Partial<PlanSetCreate>
  ) => {
    const updated = [...days];
    const targetEx = updated[dayIndex].exercises[exerciseIndex];
    targetEx.sets[setIndex] = { ...targetEx.sets[setIndex], ...patch };
    setDays(updated);
  };

  const removeSet = (dayIndex: number, exerciseIndex: number, setIndex: number) => {
    const updated = [...days];
    const targetEx = updated[dayIndex].exercises[exerciseIndex];
    if (targetEx.sets.length <= 1) return;
    targetEx.sets = targetEx.sets.filter((_, idx) => idx !== setIndex);
    setDays(updated);
  };

  const buildPayload = (): PlanCreate => ({
    name: name.trim(),
    description: description.trim() || null,
    is_shared: isShared,
    days: days.map((d) => ({
      label: d.label,
      exercises: d.exercises.map((ex) => ({
        exercise_id: ex.exercise_id,
        sets: ex.sets.map((s) => ({
          target_reps: s.target_reps,
          target_weight_type: s.target_weight_type,
          target_weight_kg: s.target_weight_kg,
          offset_kg: s.offset_kg,
          is_warmup: s.is_warmup,
        })),
      })),
    })),
  });

  return {
    name,
    setName,
    description,
    setDescription,
    isShared,
    setIsShared,
    days,
    activeDayIndex,
    setActiveDayIndex,
    nameError,
    setNameError,
    addDay,
    deleteDay,
    updateDayLabel,
    addExercise,
    removeExercise,
    addSet,
    updateSet,
    removeSet,
    buildPayload,
  };
}
