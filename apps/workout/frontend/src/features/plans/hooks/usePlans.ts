"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useActiveHouseholdId } from "@/core/hooks/useActiveHouseholdId";
import { plansApi, type PlanListParams } from "../api/plansApi";
import type {
  PlanCreate,
  PlanDayCreate,
  PlanExerciseCreate,
  PlanRead,
  PlanSetCreate,
  PlanSetUpdate,
  PlanUpdate,
  ResolvedDayRead,
} from "../types";

export const planKeys = {
  all: (householdId: string | null) => ["plans", { householdId }] as const,
  lists: (householdId: string | null) => [...planKeys.all(householdId), "list"] as const,
  list: (householdId: string | null, params?: PlanListParams) =>
    [...planKeys.lists(householdId), params ?? {}] as const,
  details: (householdId: string | null) => [...planKeys.all(householdId), "detail"] as const,
  detail: (householdId: string | null, planId: string) =>
    [...planKeys.details(householdId), planId] as const,
  resolvedDays: (householdId: string | null) =>
    [...planKeys.all(householdId), "resolved"] as const,
  resolvedDay: (householdId: string | null, planId: string, dayId: string) =>
    [...planKeys.resolvedDays(householdId), planId, dayId] as const,
};

export function usePlans(params: PlanListParams = {}) {
  const householdId = useActiveHouseholdId();

  return useQuery<PlanRead[]>({
    queryKey: planKeys.list(householdId, params),
    queryFn: () => plansApi.list(params),
  });
}

export function usePlan(planId: string | null) {
  const householdId = useActiveHouseholdId();

  return useQuery<PlanRead>({
    queryKey: planId ? planKeys.detail(householdId, planId) : ["plans", "disabled"],
    queryFn: () => plansApi.get(planId!),
    enabled: Boolean(planId),
  });
}

export function useResolvedDay(planId: string | null, dayId: string | null) {
  const householdId = useActiveHouseholdId();

  return useQuery<ResolvedDayRead>({
    queryKey:
      planId && dayId
        ? planKeys.resolvedDay(householdId, planId, dayId)
        : ["plans", "resolved", "disabled"],
    queryFn: () => plansApi.getResolvedDay(planId!, dayId!),
    enabled: Boolean(planId && dayId),
  });
}

export function useCreatePlan() {
  const queryClient = useQueryClient();
  const householdId = useActiveHouseholdId();

  return useMutation({
    mutationFn: (payload: PlanCreate) => plansApi.create(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: planKeys.all(householdId) });
    },
  });
}

export function useUpdatePlan(planId: string) {
  const queryClient = useQueryClient();
  const householdId = useActiveHouseholdId();

  return useMutation({
    mutationFn: (payload: PlanUpdate) => plansApi.update(planId, payload),
    onSuccess: (updated) => {
      queryClient.setQueryData(planKeys.detail(householdId, planId), updated);
      queryClient.invalidateQueries({ queryKey: planKeys.lists(householdId) });
      queryClient.invalidateQueries({ queryKey: planKeys.resolvedDays(householdId) });
    },
  });
}

export function useDeletePlan() {
  const queryClient = useQueryClient();
  const householdId = useActiveHouseholdId();

  return useMutation({
    mutationFn: (planId: string) => plansApi.remove(planId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: planKeys.all(householdId) });
    },
  });
}

export function useAddPlanDay(planId: string) {
  const queryClient = useQueryClient();
  const householdId = useActiveHouseholdId();

  return useMutation({
    mutationFn: (payload: PlanDayCreate) => plansApi.addDay(planId, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: planKeys.detail(householdId, planId) });
    },
  });
}

export function useDeletePlanDay(planId: string) {
  const queryClient = useQueryClient();
  const householdId = useActiveHouseholdId();

  return useMutation({
    mutationFn: (dayId: string) => plansApi.removeDay(planId, dayId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: planKeys.detail(householdId, planId) });
    },
  });
}

export function useAddPlanExercise(planId: string, dayId: string) {
  const queryClient = useQueryClient();
  const householdId = useActiveHouseholdId();

  return useMutation({
    mutationFn: (payload: PlanExerciseCreate) => plansApi.addExercise(planId, dayId, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: planKeys.detail(householdId, planId) });
      queryClient.invalidateQueries({ queryKey: planKeys.resolvedDay(householdId, planId, dayId) });
    },
  });
}

export function useDeletePlanExercise(planId: string, dayId: string) {
  const queryClient = useQueryClient();
  const householdId = useActiveHouseholdId();

  return useMutation({
    mutationFn: (planExerciseId: string) => plansApi.removeExercise(planId, dayId, planExerciseId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: planKeys.detail(householdId, planId) });
      queryClient.invalidateQueries({ queryKey: planKeys.resolvedDay(householdId, planId, dayId) });
    },
  });
}

export function useAddPlanSet(planId: string, dayId: string, planExerciseId: string) {
  const queryClient = useQueryClient();
  const householdId = useActiveHouseholdId();

  return useMutation({
    mutationFn: (payload: PlanSetCreate) => plansApi.addSet(planId, dayId, planExerciseId, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: planKeys.detail(householdId, planId) });
      queryClient.invalidateQueries({ queryKey: planKeys.resolvedDay(householdId, planId, dayId) });
    },
  });
}

export function useUpdatePlanSet(planId: string, dayId: string, planExerciseId: string) {
  const queryClient = useQueryClient();
  const householdId = useActiveHouseholdId();

  return useMutation({
    mutationFn: ({ setId, payload }: { setId: string; payload: PlanSetUpdate }) =>
      plansApi.updateSet(planId, dayId, planExerciseId, setId, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: planKeys.detail(householdId, planId) });
      queryClient.invalidateQueries({ queryKey: planKeys.resolvedDay(householdId, planId, dayId) });
    },
  });
}

export function useDeletePlanSet(planId: string, dayId: string, planExerciseId: string) {
  const queryClient = useQueryClient();
  const householdId = useActiveHouseholdId();

  return useMutation({
    mutationFn: (setId: string) => plansApi.removeSet(planId, dayId, planExerciseId, setId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: planKeys.detail(householdId, planId) });
      queryClient.invalidateQueries({ queryKey: planKeys.resolvedDay(householdId, planId, dayId) });
    },
  });
}
