"use client";

import { useQuery } from "@tanstack/react-query";
import { useActiveHousehold } from "@alfheim/shared";
import { analyticsApi } from "../api/analyticsApi";
import type {
  LeaderboardResponse,
  MuscleVolumeParams,
  MuscleVolumeResponse,
  StreakResponse,
} from "../types";

/**
 * Query keys are scoped by household id so switching households cannot serve
 * another tenant's cached entries. All three analytics endpoints are
 * read-only, so no invalidation helpers are needed here.
 */
export const analyticsKeys = {
  all: (householdId: string | null) => ["analytics", { householdId }] as const,
  muscleVolume: (householdId: string | null, params?: MuscleVolumeParams) =>
    [...analyticsKeys.all(householdId), "muscle-volume", params ?? {}] as const,
  streaks: (householdId: string | null) => [...analyticsKeys.all(householdId), "streaks"] as const,
  leaderboard: (householdId: string | null) =>
    [...analyticsKeys.all(householdId), "leaderboard"] as const,
};

export function useMuscleVolume(params: MuscleVolumeParams = {}) {
  const { householdId, status } = useActiveHousehold();

  return useQuery<MuscleVolumeResponse>({
    queryKey: analyticsKeys.muscleVolume(householdId, params),
    queryFn: () => analyticsApi.getMuscleVolume(params),
    enabled: status === "ready",
  });
}

export function useStreaks() {
  const { householdId, status } = useActiveHousehold();

  return useQuery<StreakResponse>({
    queryKey: analyticsKeys.streaks(householdId),
    queryFn: () => analyticsApi.getStreaks(),
    enabled: status === "ready",
  });
}

export function useLeaderboard() {
  const { householdId, status } = useActiveHousehold();

  return useQuery<LeaderboardResponse>({
    queryKey: analyticsKeys.leaderboard(householdId),
    queryFn: () => analyticsApi.getLeaderboard(),
    enabled: status === "ready",
  });
}
