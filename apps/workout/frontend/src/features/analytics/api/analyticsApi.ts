import { workoutClient } from "@/core/api";
import type {
  LeaderboardResponse,
  MuscleVolumeParams,
  MuscleVolumeResponse,
  StreakResponse,
} from "../types";

const RESOURCE = "api/v1/analytics";

/**
 * Raw HTTP calls for the analytics resource. Every endpoint is read-only —
 * there are no mutations in this slice.
 *
 * This layer holds no caching or React state — TanStack Query wrappers live in
 * ../hooks. Tenant headers are attached centrally by the ky client.
 */
export const analyticsApi = {
  getMuscleVolume(params: MuscleVolumeParams = {}): Promise<MuscleVolumeResponse> {
    const searchParams: Record<string, string> = {};
    if (params.from_date !== undefined) searchParams.from_date = params.from_date;
    if (params.to_date !== undefined) searchParams.to_date = params.to_date;

    return workoutClient
      .get(`${RESOURCE}/muscle-volume`, { searchParams })
      .json<MuscleVolumeResponse>();
  },

  getStreaks(): Promise<StreakResponse> {
    return workoutClient.get(`${RESOURCE}/streaks`).json<StreakResponse>();
  },

  getLeaderboard(): Promise<LeaderboardResponse> {
    return workoutClient.get(`${RESOURCE}/leaderboard`).json<LeaderboardResponse>();
  },
};
