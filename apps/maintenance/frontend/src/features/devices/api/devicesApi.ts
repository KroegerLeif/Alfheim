import { maintenanceClient } from "@/core/api";
import { Household, Device, CreateDevicePayload } from "@/shared/types";

export const getHouseholds = async (): Promise<Household[]> => {
  return await maintenanceClient.get("households").json<Household[]>();
};

export const getDevices = async (householdId?: number | null): Promise<Device[]> => {
  const searchParams: Record<string, string> = {};
  if (householdId !== undefined && householdId !== null) {
    searchParams["household_id"] = householdId.toString();
  }
  return await maintenanceClient.get("devices", { searchParams }).json<Device[]>();
};

export const createDevice = async (payload: CreateDevicePayload): Promise<Device> => {
  return await maintenanceClient.post("devices", { json: payload }).json<Device>();
};
