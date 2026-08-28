import { workoutClient } from "@/core/api";
import type { SessionListParams, StartSessionRequest, WorkoutSessionRead } from "../types";

const RESOURCE = "api/v1/sessions";

export const sessionsApi = {
  list(params: SessionListParams = {}): Promise<WorkoutSessionRead[]> {
    const searchParams: Record<string, string | number> = {};
    if (params.status_filter) searchParams.status_filter = params.status_filter;
    if (params.limit !== undefined) searchParams.limit = params.limit;
    if (params.offset !== undefined) searchParams.offset = params.offset;

    return workoutClient.get(RESOURCE, { searchParams }).json<WorkoutSessionRead[]>();
  },

  get(id: string): Promise<WorkoutSessionRead> {
    return workoutClient.get(`${RESOURCE}/${id}`).json<WorkoutSessionRead>();
  },

  /** Clones the given plan day's state; omit both fields for a freeform session. */
  start(payload: StartSessionRequest): Promise<WorkoutSessionRead> {
    return workoutClient.post(RESOURCE, { json: payload }).json<WorkoutSessionRead>();
  },

  complete(id: string): Promise<WorkoutSessionRead> {
    return workoutClient.post(`${RESOURCE}/${id}/complete`).json<WorkoutSessionRead>();
  },

  abandon(id: string): Promise<WorkoutSessionRead> {
    return workoutClient.post(`${RESOURCE}/${id}/abandon`).json<WorkoutSessionRead>();
  },
};
