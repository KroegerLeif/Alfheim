"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useActiveHouseholdId } from "@/core/hooks/useActiveHouseholdId";
import { sessionsApi } from "../api/sessionsApi";
import type { SessionListParams, StartSessionRequest, WorkoutSessionRead } from "../types";

export const sessionKeys = {
  all: (householdId: string | null) => ["sessions", { householdId }] as const,
  list: (householdId: string | null, params?: SessionListParams) =>
    [...sessionKeys.all(householdId), "list", params ?? {}] as const,
  detail: (householdId: string | null, id: string) =>
    [...sessionKeys.all(householdId), "detail", id] as const,
};

export function useSessionList(params: SessionListParams = {}) {
  const householdId = useActiveHouseholdId();

  return useQuery<WorkoutSessionRead[]>({
    queryKey: sessionKeys.list(householdId, params),
    queryFn: () => sessionsApi.list(params),
  });
}

/** The single in-progress session, if any. Sessions are strictly per-user. */
export function useActiveSession() {
  const query = useSessionList({ status_filter: "active", limit: 1 });
  return { ...query, activeSession: (query.data ?? [])[0] ?? null };
}

export function useSessionDetail(id: string) {
  const householdId = useActiveHouseholdId();

  return useQuery<WorkoutSessionRead>({
    queryKey: sessionKeys.detail(householdId, id),
    queryFn: () => sessionsApi.get(id),
    enabled: Boolean(id),
  });
}

export function useStartSession() {
  const queryClient = useQueryClient();
  const householdId = useActiveHouseholdId();

  return useMutation<WorkoutSessionRead, Error, StartSessionRequest>({
    mutationFn: (payload) => sessionsApi.start(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: sessionKeys.all(householdId) });
    },
  });
}

export function useCompleteSession() {
  const queryClient = useQueryClient();
  const householdId = useActiveHouseholdId();

  return useMutation<WorkoutSessionRead, Error, string>({
    mutationFn: (id) => sessionsApi.complete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: sessionKeys.all(householdId) });
    },
  });
}

export function useAbandonSession() {
  const queryClient = useQueryClient();
  const householdId = useActiveHouseholdId();

  return useMutation<WorkoutSessionRead, Error, string>({
    mutationFn: (id) => sessionsApi.abandon(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: sessionKeys.all(householdId) });
    },
  });
}
