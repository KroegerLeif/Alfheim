import { maintenanceClient } from "@/core/api";
import { MaintenanceSubmitPayload, ServiceHistoryEvent } from "@/shared/types";

export const submitMaintenance = async (payload: MaintenanceSubmitPayload): Promise<ServiceHistoryEvent> => {
  return await maintenanceClient.post("submit", { json: payload }).json<ServiceHistoryEvent>();
};
