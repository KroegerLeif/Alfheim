import type { ModelBlock } from "@/features/conversations/types";
import { request } from "./client";

export function listModelBlocks(): Promise<ModelBlock[]> {
  return request<ModelBlock[]>("/model-blocks");
}

export function getModelBlock(id: string): Promise<ModelBlock> {
  return request<ModelBlock>(`/model-blocks/${id}`);
}

export function createModelBlock(payload: {
  display_name: string;
  provider_type: string;
  model_identifier: string;
  base_url?: string;
  api_key?: string;
  visibility: "private" | "shared";
}): Promise<ModelBlock> {
  return request<ModelBlock>("/model-blocks", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function updateModelBlock(
  id: string,
  payload: {
    display_name?: string;
    model_identifier?: string;
    base_url?: string;
    api_key?: string;
    visibility?: "private" | "shared";
  }
): Promise<ModelBlock> {
  return request<ModelBlock>(`/model-blocks/${id}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export function deleteModelBlock(id: string): Promise<void> {
  return request<void>(`/model-blocks/${id}`, { method: "DELETE" });
}

export function triggerModelBlockHealthCheck(id: string): Promise<ModelBlock> {
  return request<ModelBlock>(`/model-blocks/${id}/health-check`, {
    method: "POST",
  });
}

export function discoverModels(payload: {
  provider_type: string;
  base_url?: string;
  api_key?: string;
}): Promise<{ models: string[] }> {
  return request<{ models: string[] }>("/models/discover", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}
