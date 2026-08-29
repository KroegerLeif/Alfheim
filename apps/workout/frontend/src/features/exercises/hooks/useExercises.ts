"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useActiveHouseholdId } from "@/core/hooks/useActiveHouseholdId";
import { exercisesApi } from "../api/exercisesApi";
import type {
  ExerciseCreate,
  ExerciseFavoriteRead,
  ExerciseListParams,
  ExerciseRead,
  ExerciseUpdate,
  UserExercisePreferenceRead,
  UserExercisePreferenceUpsert,
} from "../types";

/**
 * Query keys are scoped by household id so switching households cannot serve
 * another tenant's cached entries.
 */
export const exerciseKeys = {
  all: (householdId: string | null) => ["exercises", { householdId }] as const,
  list: (householdId: string | null, params?: ExerciseListParams) =>
    [...exerciseKeys.all(householdId), "list", params ?? {}] as const,
  favorites: (householdId: string | null) =>
    [...exerciseKeys.all(householdId), "favorites"] as const,
  detail: (householdId: string | null, id: string) =>
    [...exerciseKeys.all(householdId), "detail", id] as const,
  preference: (householdId: string | null, id: string) =>
    [...exerciseKeys.all(householdId), "preference", id] as const,
};

export function useExerciseList(params: ExerciseListParams = {}) {
  const householdId = useActiveHouseholdId();

  return useQuery<ExerciseRead[]>({
    queryKey: exerciseKeys.list(householdId, params),
    queryFn: () => exercisesApi.list(params),
  });
}

export function useFavoriteExercises() {
  const householdId = useActiveHouseholdId();

  return useQuery<ExerciseRead[]>({
    queryKey: exerciseKeys.favorites(householdId),
    queryFn: () => exercisesApi.listFavorites(),
  });
}

export function useExerciseDetail(id: string) {
  const householdId = useActiveHouseholdId();

  return useQuery<ExerciseRead>({
    queryKey: exerciseKeys.detail(householdId, id),
    queryFn: () => exercisesApi.get(id),
    enabled: Boolean(id),
  });
}

export function useExercisePreference(id: string) {
  const householdId = useActiveHouseholdId();

  return useQuery<UserExercisePreferenceRead>({
    queryKey: exerciseKeys.preference(householdId, id),
    queryFn: () => exercisesApi.getPreference(id),
    enabled: Boolean(id),
    retry: false,
  });
}

export function useCreateExercise() {
  const queryClient = useQueryClient();
  const householdId = useActiveHouseholdId();

  return useMutation<ExerciseRead, Error, ExerciseCreate>({
    mutationFn: (payload) => exercisesApi.create(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: exerciseKeys.all(householdId) });
    },
  });
}

export function useUpdateExercise() {
  const queryClient = useQueryClient();
  const householdId = useActiveHouseholdId();

  return useMutation<ExerciseRead, Error, { id: string; payload: ExerciseUpdate }>({
    mutationFn: ({ id, payload }) => exercisesApi.update(id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: exerciseKeys.all(householdId) });
    },
  });
}

export function useDeleteExercise() {
  const queryClient = useQueryClient();
  const householdId = useActiveHouseholdId();

  return useMutation<void, Error, string>({
    mutationFn: (id) => exercisesApi.remove(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: exerciseKeys.all(householdId) });
    },
  });
}

export function useUpsertExercisePreference() {
  const queryClient = useQueryClient();
  const householdId = useActiveHouseholdId();

  return useMutation<
    UserExercisePreferenceRead,
    Error,
    { id: string; payload: UserExercisePreferenceUpsert }
  >({
    mutationFn: ({ id, payload }) => exercisesApi.upsertPreference(id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: exerciseKeys.all(householdId) });
    },
  });
}

export function useAddFavorite() {
  const queryClient = useQueryClient();
  const householdId = useActiveHouseholdId();

  return useMutation<ExerciseFavoriteRead, Error, string>({
    mutationFn: (id) => exercisesApi.addFavorite(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: exerciseKeys.all(householdId) });
    },
  });
}

export function useRemoveFavorite() {
  const queryClient = useQueryClient();
  const householdId = useActiveHouseholdId();

  return useMutation<void, Error, string>({
    mutationFn: (id) => exercisesApi.removeFavorite(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: exerciseKeys.all(householdId) });
    },
  });
}
