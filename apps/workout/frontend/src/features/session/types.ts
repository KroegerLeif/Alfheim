/** Mirrors `SessionStatus` in apps/workout/backend/src/features/session/models.py. */
export type SessionStatus = "active" | "completed" | "abandoned";

/**
 * Mirrors `SessionSetRead`.
 *
 * `target_weight_kg` is the weight-engine value already RESOLVED by the backend
 * at session-start; the client never re-derives absolute/default/offset math.
 */
export interface SessionSetRead {
  id: string;
  set_order: number;
  target_reps: number | null;
  target_weight_kg: number | null;
  actual_reps: number | null;
  actual_weight_kg: number | null;
  is_warmup: boolean;
  completed_at: string | null;
  client_idempotency_key: string | null;
}

/** Mirrors `SessionExerciseRead`. Name and muscle are snapshots taken at start-time. */
export interface SessionExerciseRead {
  id: string;
  exercise_id: string;
  exercise_name_snapshot: string;
  primary_muscle_snapshot: string;
  exercise_order: number;
  sets: SessionSetRead[];
}

/** Mirrors `WorkoutSessionRead`. */
export interface WorkoutSessionRead {
  id: string;
  home_id: string;
  user_id: string;
  plan_id: string | null;
  plan_day_label: string | null;
  started_at: string;
  completed_at: string | null;
  status: SessionStatus;
  notes: string | null;
  exercises: SessionExerciseRead[];
}

/** Mirrors `StartSessionRequest`. Both fields are required together or both omitted. */
export interface StartSessionRequest {
  plan_id?: string | null;
  plan_day_id?: string | null;
}

export interface SessionListParams {
  status_filter?: SessionStatus;
  limit?: number;
  offset?: number;
}

/** A set counts as done once the backend has a completion timestamp for it. */
export function isSetCompleted(set: SessionSetRead): boolean {
  return set.completed_at !== null;
}

/** Index of the first not-yet-completed set, or -1 when the exercise is finished. */
export function firstOpenSetIndex(sets: SessionSetRead[]): number {
  return (sets ?? []).findIndex((set) => !isSetCompleted(set));
}
