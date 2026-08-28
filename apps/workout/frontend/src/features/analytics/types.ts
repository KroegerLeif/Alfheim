/** Mirrors `MuscleVolumeEntry` in apps/workout/backend/src/features/analytics/schemas.py. */
export interface MuscleVolumeEntry {
  primary_muscle: string;
  total_volume_kg: number;
}

/** Mirrors `MuscleVolumeResponse`. */
export interface MuscleVolumeResponse {
  from_date: string | null;
  to_date: string | null;
  entries: MuscleVolumeEntry[];
}

/** Mirrors `StreakResponse`. */
export interface StreakResponse {
  current_streak_days: number;
  longest_streak_days: number;
}

/** Mirrors `LeaderboardEntry`. The backend returns a raw user id with no display name. */
export interface LeaderboardEntry {
  user_id: string;
  total_volume_kg: number;
  completed_session_count: number;
}

/** Mirrors `LeaderboardResponse`. */
export interface LeaderboardResponse {
  entries: LeaderboardEntry[];
}

/** Query params accepted by `GET /api/v1/analytics/muscle-volume`, both `YYYY-MM-DD`. */
export interface MuscleVolumeParams {
  from_date?: string;
  to_date?: string;
}
