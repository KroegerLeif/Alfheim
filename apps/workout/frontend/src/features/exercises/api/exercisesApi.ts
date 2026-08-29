import { workoutClient } from "@/core/api";
import type {
  ExerciseCreate,
  ExerciseFavoriteRead,
  ExerciseListParams,
  ExerciseRead,
  ExerciseUpdate,
  UserExercisePreferenceRead,
  UserExercisePreferenceUpsert,
} from "../types";

const RESOURCE = "api/v1/exercises";

/**
 * Raw HTTP calls for the exercises resource.
 *
 * This layer holds no caching or React state — TanStack Query wrappers live in
 * ../hooks. Tenant headers are attached centrally by the ky client.
 */
export const exercisesApi = {
  list(params: ExerciseListParams = {}): Promise<ExerciseRead[]> {
    const searchParams: Record<string, string | number | boolean> = {};
    if (params.primary_muscle !== undefined) searchParams.primary_muscle = params.primary_muscle;
    if (params.is_active !== undefined) searchParams.is_active = params.is_active;
    if (params.limit !== undefined) searchParams.limit = params.limit;
    if (params.offset !== undefined) searchParams.offset = params.offset;

    return workoutClient.get(RESOURCE, { searchParams }).json<ExerciseRead[]>();
  },

  listFavorites(): Promise<ExerciseRead[]> {
    return workoutClient.get(`${RESOURCE}/favorites`).json<ExerciseRead[]>();
  },

  get(id: string): Promise<ExerciseRead> {
    return workoutClient.get(`${RESOURCE}/${id}`).json<ExerciseRead>();
  },

  create(payload: ExerciseCreate): Promise<ExerciseRead> {
    return workoutClient.post(RESOURCE, { json: payload }).json<ExerciseRead>();
  },

  update(id: string, payload: ExerciseUpdate): Promise<ExerciseRead> {
    return workoutClient.patch(`${RESOURCE}/${id}`, { json: payload }).json<ExerciseRead>();
  },

  async remove(id: string): Promise<void> {
    // The endpoint returns 204 with an empty body, so the response is not parsed.
    await workoutClient.delete(`${RESOURCE}/${id}`);
  },

  getPreference(id: string): Promise<UserExercisePreferenceRead> {
    return workoutClient.get(`${RESOURCE}/${id}/preference`).json<UserExercisePreferenceRead>();
  },

  upsertPreference(
    id: string,
    payload: UserExercisePreferenceUpsert
  ): Promise<UserExercisePreferenceRead> {
    return workoutClient
      .put(`${RESOURCE}/${id}/preference`, { json: payload })
      .json<UserExercisePreferenceRead>();
  },

  addFavorite(id: string): Promise<ExerciseFavoriteRead> {
    return workoutClient.post(`${RESOURCE}/${id}/favorite`).json<ExerciseFavoriteRead>();
  },

  async removeFavorite(id: string): Promise<void> {
    // The endpoint returns 204 with an empty body, so the response is not parsed.
    await workoutClient.delete(`${RESOURCE}/${id}/favorite`);
  },
};
