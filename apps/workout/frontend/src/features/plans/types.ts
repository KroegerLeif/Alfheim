/** Mirrors `TargetWeightType` in apps/workout/backend/src/features/plans/models.py. */
export type TargetWeightType = "absolute" | "default" | "offset";

export interface PlanSetRead {
  id: string;
  set_order: number;
  target_reps: number | null;
  target_weight_type: TargetWeightType;
  target_weight_kg: number | null;
  offset_kg: number | null;
  is_warmup: boolean;
}

export interface PlanSetCreate {
  target_reps?: number | null;
  target_weight_type?: TargetWeightType;
  target_weight_kg?: number | null;
  offset_kg?: number | null;
  is_warmup?: boolean;
}

export type PlanSetUpdate = PlanSetCreate;

export interface PlanExerciseRead {
  id: string;
  exercise_id: string;
  exercise_order: number;
  sets: PlanSetRead[];
}

export interface PlanExerciseCreate {
  exercise_id: string;
  sets?: PlanSetCreate[];
}

export interface PlanDayRead {
  id: string;
  day_order: number;
  label: string;
  exercises: PlanExerciseRead[];
}

export interface PlanDayCreate {
  label: string;
  exercises?: PlanExerciseCreate[];
}

export interface PlanRead {
  id: string;
  home_id: string;
  owner_user_id: string;
  name: string;
  description: string | null;
  is_shared: boolean;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  days: PlanDayRead[];
}

export interface PlanCreate {
  name: string;
  description?: string | null;
  is_shared?: boolean;
  days?: PlanDayCreate[];
}

export interface PlanUpdate {
  name?: string;
  description?: string | null;
  is_shared?: boolean;
  is_active?: boolean;
  days?: PlanDayCreate[];
}

/**
 * One set with its weight-engine target already resolved by the backend.
 *
 * `resolved_weight_kg` is null when the mode needs a baseline the user has not
 * set yet (`default`/`offset` with no UserExercisePreference).
 */
export interface ResolvedSetRead {
  id: string;
  set_order: number;
  target_reps: number | null;
  target_weight_type: TargetWeightType;
  resolved_weight_kg: number | null;
  is_warmup: boolean;
}

export interface ResolvedExerciseRead {
  id: string;
  exercise_id: string;
  exercise_order: number;
  sets: ResolvedSetRead[];
}

export interface ResolvedDayRead {
  id: string;
  day_order: number;
  label: string;
  exercises: ResolvedExerciseRead[];
}

export const TARGET_WEIGHT_TYPE_LABEL_KEYS: Record<TargetWeightType, string> = {
  absolute: "workout.weightAbsolute",
  default: "workout.weightDefault",
  offset: "workout.weightOffset",
};

/**
 * Enforce the backend's weight-engine field rules client-side so an invalid
 * combination is caught before it round-trips into a 400.
 *
 * Returns an i18n key describing the problem, or null when the combination is
 * valid. Mirrors `validate_weight_fields` in
 * apps/workout/backend/src/features/plans/services/weight_engine_service.py.
 */
export function validateWeightFields(
  type: TargetWeightType,
  targetWeightKg: number | null,
  offsetKg: number | null
): string | null {
  if (type === "absolute") {
    if (targetWeightKg === null) return "workout.weightAbsolute";
    if (offsetKg !== null) return "workout.weightOffset";
    return null;
  }
  if (type === "offset") {
    if (offsetKg === null) return "workout.weightOffset";
    if (targetWeightKg !== null) return "workout.weightAbsolute";
    return null;
  }
  if (targetWeightKg !== null || offsetKg !== null) return "workout.weightDefault";
  return null;
}

/** Only the owner may edit a plan, even when it is shared with the household. */
export function isPlanEditableBy(plan: PlanRead, userId: string | null): boolean {
  return Boolean(userId) && plan.owner_user_id === userId;
}
