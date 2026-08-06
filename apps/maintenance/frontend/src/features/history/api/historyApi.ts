import { maintenanceClient } from "@/core/api";
import { ServiceHistoryEventDetail } from "@/shared/types";

export const getServiceHistory = async (householdId?: number | null): Promise<ServiceHistoryEventDetail[]> => {
  const searchParams: Record<string, string> = {};
  if (householdId !== undefined && householdId !== null) {
    searchParams["household_id"] = householdId.toString();
  }
  return await maintenanceClient.get("history", { searchParams }).json<ServiceHistoryEventDetail[]>();
};
