import { maintenanceClient } from "@/core/api";
import { TaskStateUpdatePayload, MaintenanceStep } from "@/shared/types";

export const updateTaskState = async (
  stepId: number,
  payload: TaskStateUpdatePayload,
): Promise<MaintenanceStep> => {
  return await maintenanceClient
    .post(`tasks/${stepId}/state`, { json: payload })
    .json<MaintenanceStep>();
};
