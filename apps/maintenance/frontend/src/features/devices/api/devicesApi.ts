import { householdHeaders } from "@alfheim/shared";
import { maintenanceClient } from "@/core/api";
import {
  Device,
  CreateDevicePayload,
  CreateStepPayload,
  MaintenanceStep,
  UpdateDevicePayload,
  UpdateStepPayload,
} from "@/shared/types";

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
    .post("devices", payload, { headers: householdHeaders(householdId ?? null) })
    .json<Device>();
};

/** Changes the fields sent in `payload` of a device of the active household. */
export const updateDevice = async (deviceId: number, payload: UpdateDevicePayload): Promise<Device> => {
  return await maintenanceClient.patch(`devices/${deviceId}`, payload).json<Device>();
};

/** Deletes a device together with its steps and service history. */
export const deleteDevice = async (deviceId: number): Promise<void> => {
  await maintenanceClient.delete(`devices/${deviceId}`);
};

/** Adds a maintenance step; the backend seeds its first due date. */
export const addStep = async (deviceId: number, payload: CreateStepPayload): Promise<MaintenanceStep> => {
  return await maintenanceClient.post(`devices/${deviceId}/steps`, payload).json<MaintenanceStep>();
};

/** Changes the fields sent in `payload` of a step; a new interval moves its due date. */
export const updateStep = async (
  deviceId: number,
  stepId: number,
  payload: UpdateStepPayload
): Promise<MaintenanceStep> => {
  return await maintenanceClient.patch(`devices/${deviceId}/steps/${stepId}`, payload).json<MaintenanceStep>();
};

/** Removes a step from a device. */
export const deleteStep = async (deviceId: number, stepId: number): Promise<void> => {
  await maintenanceClient.delete(`devices/${deviceId}/steps/${stepId}`);
};
