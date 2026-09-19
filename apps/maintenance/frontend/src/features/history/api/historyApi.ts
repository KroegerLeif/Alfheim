import { maintenanceClient } from "@/core/api";
import { ServiceHistoryEventDetail } from "@/shared/types";

/** Service history of the active household (scoped server-side by X-Household-ID). */
export const getServiceHistory = async (): Promise<ServiceHistoryEventDetail[]> => {
  return await maintenanceClient.get("history").json<ServiceHistoryEventDetail[]>();
};
