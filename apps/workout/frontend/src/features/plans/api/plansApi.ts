import { workoutClient } from "@/core/api";
import type {
  PlanCreate,
  PlanDayCreate,
  PlanDayRead,
  PlanExerciseCreate,
  PlanExerciseRead,
  PlanRead,
  PlanSetCreate,
  PlanSetRead,
  PlanSetUpdate,
  PlanUpdate,
  ResolvedDayRead,
} from "../types";

const RESOURCE = "api/v1/plans";

export interface PlanListParams {
  limit?: number;
  offset?: number;
}

export const plansApi = {
  list(params: PlanListParams = {}): Promise<PlanRead[]> {
    const searchParams: Record<string, number> = {};
    if (params.limit !== undefined) searchParams.limit = params.limit;
    if (params.offset !== undefined) searchParams.offset = params.offset;

    return workoutClient.get(RESOURCE, { searchParams }).json<PlanRead[]>();
  },

  get(planId: string): Promise<PlanRead> {
    return workoutClient.get(`${RESOURCE}/${planId}`).json<PlanRead>();
  },

  create(payload: PlanCreate): Promise<PlanRead> {
    return workoutClient.post(RESOURCE, { json: payload }).json<PlanRead>();
  },

  update(planId: string, payload: PlanUpdate): Promise<PlanRead> {
    return workoutClient.patch(`${RESOURCE}/${planId}`, { json: payload }).json<PlanRead>();
  },

  async remove(planId: string): Promise<void> {
    await workoutClient.delete(`${RESOURCE}/${planId}`);
  },

  addDay(planId: string, payload: PlanDayCreate): Promise<PlanDayRead> {
    return workoutClient.post(`${RESOURCE}/${planId}/days`, { json: payload }).json<PlanDayRead>();
  },

  async removeDay(planId: string, dayId: string): Promise<void> {
    await workoutClient.delete(`${RESOURCE}/${planId}/days/${dayId}`);
  },

  addExercise(
    planId: string,
    dayId: string,
    payload: PlanExerciseCreate
  ): Promise<PlanExerciseRead> {
    return workoutClient
      .post(`${RESOURCE}/${planId}/days/${dayId}/exercises`, { json: payload })
      .json<PlanExerciseRead>();
  },

  async removeExercise(planId: string, dayId: string, planExerciseId: string): Promise<void> {
    await workoutClient.delete(`${RESOURCE}/${planId}/days/${dayId}/exercises/${planExerciseId}`);
  },

  addSet(
    planId: string,
    dayId: string,
    planExerciseId: string,
    payload: PlanSetCreate
  ): Promise<PlanSetRead> {
    return workoutClient
      .post(`${RESOURCE}/${planId}/days/${dayId}/exercises/${planExerciseId}/sets`, {
        json: payload,
      })
      .json<PlanSetRead>();
  },

  updateSet(
    planId: string,
    dayId: string,
    planExerciseId: string,
    setId: string,
    payload: PlanSetUpdate
  ): Promise<PlanSetRead> {
    return workoutClient
      .patch(`${RESOURCE}/${planId}/days/${dayId}/exercises/${planExerciseId}/sets/${setId}`, {
        json: payload,
      })
      .json<PlanSetRead>();
  },

  async removeSet(
    planId: string,
    dayId: string,
    planExerciseId: string,
    setId: string
  ): Promise<void> {
    await workoutClient.delete(
      `${RESOURCE}/${planId}/days/${dayId}/exercises/${planExerciseId}/sets/${setId}`
    );
  },

  /** Weight-engine targets resolved server-side for the calling user. */
  getResolvedDay(planId: string, dayId: string): Promise<ResolvedDayRead> {
    return workoutClient
      .get(`${RESOURCE}/${planId}/days/${dayId}/resolved`)
      .json<ResolvedDayRead>();
  },
};
