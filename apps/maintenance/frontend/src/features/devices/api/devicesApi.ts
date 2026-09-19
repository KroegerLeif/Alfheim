import { householdHeaders } from "@alfheim/shared";
import { maintenanceClient } from "@/core/api";
import { Device, CreateDevicePayload } from "@/shared/types";

/** Devices of the active household (scoped server-side by X-Household-ID). */
export const getDevices = async (): Promise<Device[]> => {
  return await maintenanceClient.get("devices").json<Device[]>();
};

/**
 * Creates a device in `householdId` when given (sent as an explicit
 * X-Household-ID), otherwise in the active household.
 */
export const createDevice = async (payload: CreateDevicePayload, householdId?: string | null): Promise<Device> => {
  return await maintenanceClient
    .post("devices", { json: payload, headers: householdHeaders(householdId ?? null) })
    .json<Device>();
};
