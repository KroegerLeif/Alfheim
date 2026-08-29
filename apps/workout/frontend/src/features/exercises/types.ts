/** Mirrors `MuscleGroup` in apps/workout/backend/src/features/exercises/models.py. */
export type MuscleGroup =
  | "chest"
  | "back"
  | "shoulders"
  | "biceps"
  | "triceps"
  | "quads"
  | "hamstrings"
  | "glutes"
  | "calves"
  | "core"
  | "forearms"
  | "traps"
  | "full_body";

/** Mirrors `ExerciseScope` in apps/workout/backend/src/features/exercises/models.py. */
export type ExerciseScope = "system" | "household" | "user";

/** Mirrors `ExerciseRead`. */
export interface ExerciseRead {
  id: string;
  scope: ExerciseScope;
  home_id: string | null;
  owner_user_id: string | null;
  name: string;
  primary_muscle: MuscleGroup;
  secondary_muscles: MuscleGroup[] | null;
  equipment_id: string | null;
  default_unit: string;
  instructions: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

/** Mirrors `ExerciseCreate`. The backend rejects a `system` scope from the API. */
export interface ExerciseCreate {
  name: string;
  primary_muscle: MuscleGroup;
  secondary_muscles?: MuscleGroup[] | null;
  equipment_id?: string | null;
  default_unit?: string;
  instructions?: string | null;
  scope?: Exclude<ExerciseScope, "system">;
}

/** Mirrors `ExerciseUpdate`. */
export interface ExerciseUpdate {
  name?: string;
  primary_muscle?: MuscleGroup;
  secondary_muscles?: MuscleGroup[] | null;
  equipment_id?: string | null;
  default_unit?: string;
  instructions?: string | null;
  is_active?: boolean;
}

export interface ExerciseListParams {
  primary_muscle?: MuscleGroup;
  is_active?: boolean;
  limit?: number;
  offset?: number;
}

/** Mirrors `UserExercisePreferenceUpsert`. */
export interface UserExercisePreferenceUpsert {
  default_target_weight_kg?: number | null;
  preferred_unit?: string | null;
  notes?: string | null;
}

/** Mirrors `UserExercisePreferenceRead`. */
export interface UserExercisePreferenceRead {
  id: string;
  exercise_id: string;
  default_target_weight_kg: number | null;
  preferred_unit: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

/** Mirrors `ExerciseFavoriteRead`. */
export interface ExerciseFavoriteRead {
  id: string;
  exercise_id: string;
  created_at: string;
}

/** System entries are seeded server-side and are read-only through the API. */
export function isEditableExercise(exercise: ExerciseRead): boolean {
  return exercise.scope !== "system";
}

/** Translation keys for each muscle group, keyed into the shared workout.json locale files. */
export const MUSCLE_GROUP_LABEL_KEYS: Record<MuscleGroup, string> = {
  chest: "workout.muscleChest",
  back: "workout.muscleBack",
  shoulders: "workout.muscleShoulders",
  biceps: "workout.muscleBiceps",
  triceps: "workout.muscleTriceps",
  quads: "workout.muscleQuads",
  hamstrings: "workout.muscleHamstrings",
  glutes: "workout.muscleGlutes",
  calves: "workout.muscleCalves",
  core: "workout.muscleCore",
  forearms: "workout.muscleForearms",
  traps: "workout.muscleTraps",
  full_body: "workout.muscleFullBody",
};
