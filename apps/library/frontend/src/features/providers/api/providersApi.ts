import { libraryClient } from "@/core/api";
import {
  ProviderCreatePayload,
  ProviderSubscription,
  ProviderUpdatePayload,
} from "../types";

export async function fetchProviders(is_active?: boolean): Promise<ProviderSubscription[]> {
  const searchParams = new URLSearchParams();
  if (is_active !== undefined) {
    searchParams.set("is_active", String(is_active));
  }
  const endpoint = searchParams.toString() ? `providers?${searchParams.toString()}` : "providers";
  return libraryClient.get(endpoint).json<ProviderSubscription[]>();
}

export async function createProvider(
  payload: ProviderCreatePayload
): Promise<ProviderSubscription> {
  return libraryClient.post("providers", { json: payload }).json<ProviderSubscription>();
}

export async function updateProvider(
  id: string,
  payload: ProviderUpdatePayload
): Promise<ProviderSubscription> {
  return libraryClient.put(`providers/${id}`, { json: payload }).json<ProviderSubscription>();
}

export async function deleteProvider(id: string): Promise<void> {
  await libraryClient.delete(`providers/${id}`);
}
