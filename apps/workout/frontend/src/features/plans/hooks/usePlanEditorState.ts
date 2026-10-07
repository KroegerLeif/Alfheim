"use client";

import { useState } from "react";
import type {
  PlanCreate,
  PlanDayRead,
  PlanExerciseRead,
  PlanRead,
  PlanSetCreate,
  PlanSetRead,
} from "../types";

let tempIdCounter = 0;

/** Client-side id for rows that do not exist on the server yet; never sent in the payload. */
function tempId(prefix: string): string {
  tempIdCounter += 1;
  return `temp-${prefix}-${Date.now()}-${tempIdCounter}`;
}

function newDay(order: number): PlanDayRead {
  return { id: tempId("day"), day_order: order, label: "", exercises: [] };
}

/**
 * Local form state of the plan editor.
 *
 * Every update builds new objects: `initialPlan` comes straight out of the
 * TanStack Query cache, so mutating it in place would leak unsaved edits into
 * the cache and survive a cancelled edit.
 *
 * `fallbackDayLabel` names days whose label was left blank (the backend
 * requires a non-empty label); it receives the 1-based day position.
 */
export function usePlanEditorState(
  initialPlan?: PlanRead,
  fallbackDayLabel: (position: number) => string = (position) => String(position)
) {
  const [name, setName] = useState(initialPlan?.name ?? "");
  const [description, setDescription] = useState(initialPlan?.description ?? "");
  const [isShared, setIsShared] = useState(initialPlan?.is_shared ?? false);
  const [days, setDays] = useState<PlanDayRead[]>(
    initialPlan?.days && initialPlan.days.length > 0 ? initialPlan.days : [newDay(1)]
  );
  const [activeDayIndex, setActiveDayIndex] = useState(0);
  const [nameError, setNameError] = useState<string | null>(null);

  const updateDay = (dayIndex: number, change: (day: PlanDayRead) => PlanDayRead) =>
    setDays((current) => current.map((day, idx) => (idx === dayIndex ? change(day) : day)));

  const updateExercise = (
    dayIndex: number,
    exerciseIndex: number,
    change: (exercise: PlanExerciseRead) => PlanExerciseRead
  ) =>
    updateDay(dayIndex, (day) => ({
      ...day,
      exercises: day.exercises.map((exercise, idx) => (idx === exerciseIndex ? change(exercise) : exercise)),
    }));

  const addDay = () => {
    setDays((current) => [...current, newDay(current.length + 1)]);
    setActiveDayIndex(days.length);
  };

  const deleteDay = (dayIndex: number) => {
    if (days.length <= 1) return;
    setDays((current) => current.filter((_, idx) => idx !== dayIndex));
    setActiveDayIndex(Math.max(0, dayIndex - 1));
  };

  const updateDayLabel = (dayIndex: number, label: string) =>
    updateDay(dayIndex, (day) => ({ ...day, label }));

  const addExercise = (dayIndex: number, exerciseId: string) =>
    updateDay(dayIndex, (day) => ({
      ...day,
      exercises: [
        ...day.exercises,
        {
          id: tempId("ex"),
          exercise_id: exerciseId,
          exercise_order: day.exercises.length + 1,
          sets: [
            {
              id: tempId("set"),
              set_order: 1,
              target_reps: 10,
              target_weight_type: "default",
              target_weight_kg: null,
              offset_kg: null,
              is_warmup: false,
            },
          ],
        },
      ],
    }));

  const removeExercise = (dayIndex: number, exerciseIndex: number) =>
    updateDay(dayIndex, (day) => ({
      ...day,
      exercises: day.exercises.filter((_, idx) => idx !== exerciseIndex),
    }));

  const addSet = (dayIndex: number, exerciseIndex: number) =>
    updateExercise(dayIndex, exerciseIndex, (exercise) => {
      const lastSet = exercise.sets[exercise.sets.length - 1];
      const created: PlanSetRead = {
        id: tempId("set"),
        set_order: exercise.sets.length + 1,
        target_reps: lastSet?.target_reps ?? 10,
        target_weight_type: lastSet?.target_weight_type ?? "default",
        target_weight_kg: lastSet?.target_weight_kg ?? null,
        offset_kg: lastSet?.offset_kg ?? null,
        is_warmup: false,
      };
      return { ...exercise, sets: [...exercise.sets, created] };
    });

  const updateSet = (
    dayIndex: number,
    exerciseIndex: number,
    setIndex: number,
    patch: Partial<PlanSetCreate>
  ) =>
    updateExercise(dayIndex, exerciseIndex, (exercise) => ({
      ...exercise,
      sets: exercise.sets.map((set, idx) => (idx === setIndex ? { ...set, ...patch } : set)),
    }));

  const removeSet = (dayIndex: number, exerciseIndex: number, setIndex: number) =>
    updateExercise(dayIndex, exerciseIndex, (exercise) =>
      exercise.sets.length <= 1
        ? exercise
        : { ...exercise, sets: exercise.sets.filter((_, idx) => idx !== setIndex) }
    );

  const buildPayload = (): PlanCreate => ({
    name: name.trim(),
    description: description.trim() || null,
    is_shared: isShared,
    days: days.map((day, dayIndex) => ({
      label: day.label.trim() || fallbackDayLabel(dayIndex + 1),
      exercises: day.exercises.map((exercise) => ({
        exercise_id: exercise.exercise_id,
        sets: exercise.sets.map((set) => ({
          target_reps: set.target_reps,
          target_weight_type: set.target_weight_type,
          target_weight_kg: set.target_weight_kg,
          offset_kg: set.offset_kg,
          is_warmup: set.is_warmup,
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
