import { libraryClient } from "@/core/api";
import type {
  LocationCreatePayload,
  LocationNode,
  LocationResponse,
  LocationUpdatePayload,
} from "../types";

export async function fetchLocationsTree(): Promise<LocationNode[]> {
  return await libraryClient.get("locations", { searchParams: { tree: true } }).json<LocationNode[]>();
}

export async function fetchLocationsFlat(): Promise<LocationResponse[]> {
  return await libraryClient.get("locations").json<LocationResponse[]>();
}

export async function createLocation(payload: LocationCreatePayload): Promise<LocationResponse> {
  return await libraryClient.post("locations", { json: payload }).json<LocationResponse>();
}

export async function updateLocation(
  id: string,
  payload: LocationUpdatePayload
): Promise<LocationResponse> {
  return await libraryClient.put(`locations/${id}`, { json: payload }).json<LocationResponse>();
}

export async function deleteLocation(id: string): Promise<void> {
  await libraryClient.delete(`locations/${id}`);
}
