"use client";

import * as React from "react";
import {
  Button,
  EmptyState,
  Select,
  Skeleton,
  Spinner,
  useTranslation,
} from "@alfheim/shared";
import { Dumbbell, Minus, Plus } from "lucide-react";
import {
  useAddFavorite,
  useDeleteExercise,
  useExerciseList,
  useFavoriteExercises,
  useRemoveFavorite,
} from "../hooks/useExercises";
import type { ExerciseRead, MuscleGroup } from "../types";
import { MUSCLE_GROUP_LABEL_KEYS } from "../types";
import { ExerciseBaselineDialog } from "./ExerciseBaselineDialog";
import { ExerciseCard } from "./ExerciseCard";
import { ExerciseCreateForm } from "./ExerciseCreateForm";

const MUSCLE_GROUPS = Object.keys(MUSCLE_GROUP_LABEL_KEYS) as MuscleGroup[];

/**
 * Orchestrates the exercise catalog panel: create form toggle, muscle-group
 * filter, loading/empty/error states, and the card grid. Presentation lives
 * in the child components.
 */
export function ExerciseListView() {
  const { t } = useTranslation();
  const [isFormOpen, setIsFormOpen] = React.useState(false);
  const [muscleFilter, setMuscleFilter] = React.useState("");
  const [deletingId, setDeletingId] = React.useState<string | null>(null);
  const [togglingFavoriteId, setTogglingFavoriteId] = React.useState<string | null>(null);
  const [baselineExercise, setBaselineExercise] = React.useState<ExerciseRead | null>(null);

  const params = muscleFilter ? { primary_muscle: muscleFilter as MuscleGroup } : {};
  const { data, isLoading, isError } = useExerciseList(params);
  const { data: favoritesData } = useFavoriteExercises();
  const deleteMutation = useDeleteExercise();
  const addFavoriteMutation = useAddFavorite();
  const removeFavoriteMutation = useRemoveFavorite();

  const exercises = data ?? [];
  const favoriteIds = new Set((favoritesData ?? []).map((entry) => entry.id));

  const muscleOptions = [
    { value: "", label: t("workout.allMuscleGroups") },
    ...MUSCLE_GROUPS.map((muscle) => ({ value: muscle, label: t(MUSCLE_GROUP_LABEL_KEYS[muscle]) })),
  ];

  const handleDelete = (exercise: ExerciseRead) => {
    setDeletingId(exercise.id);
    deleteMutation.mutate(exercise.id, {
      onSettled: () => setDeletingId(null),
    });
  };

  const handleToggleFavorite = (exercise: ExerciseRead) => {
    setTogglingFavoriteId(exercise.id);
    const mutation = favoriteIds.has(exercise.id) ? removeFavoriteMutation : addFavoriteMutation;
    mutation.mutate(exercise.id, {
      onSettled: () => setTogglingFavoriteId(null),
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 border-b border-[var(--border-subtle)] pb-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <h2 className="font-heading text-xl font-bold uppercase tracking-wide">
            {t("workout.exercises")}
          </h2>
          <Select
            aria-label={t("workout.primaryMuscle")}
            options={muscleOptions}
            value={muscleFilter}
            onChange={(event) => setMuscleFilter(event.target.value)}
            className="w-auto"
          />
        </div>
        <Button
          variant="outline"
          className="min-h-11 self-start"
          onClick={() => setIsFormOpen((open) => !open)}
        >
          {isFormOpen ? <Minus aria-hidden="true" /> : <Plus aria-hidden="true" />}
          {isFormOpen ? t("workout.cancel") : t("workout.createExercise")}
        </Button>
      </div>

      {isFormOpen && (
        <ExerciseCreateForm
          onSuccess={() => setIsFormOpen(false)}
          onCancel={() => setIsFormOpen(false)}
        />
      )}

      {isError && (
        <div
          role="alert"
          className="rounded-lg border border-red-800/40 bg-red-950/20 p-4 text-xs font-bold uppercase text-red-400"
        >
          {t("workout.loadFailed")}
        </div>
      )}

      {isLoading ? (
        <div className="space-y-3">
          <Spinner label={t("workout.loading")} className="mx-auto" />
          {[0, 1, 2].map((index) => (
            <Skeleton key={index} className="h-20 w-full" />
          ))}
        </div>
      ) : exercises.length === 0 ? (
        <EmptyState icon={<Dumbbell className="h-8 w-8" />} title={t("workout.noExercises")} />
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {exercises.map((exercise) => (
            <ExerciseCard
              key={exercise.id}
              exercise={exercise}
              isFavorite={favoriteIds.has(exercise.id)}
              onToggleFavorite={handleToggleFavorite}
              isTogglingFavorite={togglingFavoriteId === exercise.id}
              onSetBaseline={setBaselineExercise}
              onDelete={handleDelete}
              isDeleting={deletingId === exercise.id}
            />
          ))}
        </div>
      )}

      <ExerciseBaselineDialog
        exercise={baselineExercise}
        open={baselineExercise !== null}
        onOpenChange={(open) => !open && setBaselineExercise(null)}
      />
    </div>
  );
}
