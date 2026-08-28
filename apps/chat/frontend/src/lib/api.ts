import type {
  ApiErrorPayload,
  Attachment,
  Conversation,
  CreateConversationRequest,
  Message,
  ModelBlock,
} from "@/features/conversations/types";
import { streamAssistantReply as sseStream, type StreamHandlers } from "@/lib/sse";

export type { StreamHandlers };

function sanitizeUrl(url: string | undefined, defaultFallback: string): string {
  let resolved = url || defaultFallback;
  if (resolved.endsWith("/")) {
    resolved = resolved.slice(0, -1);
  }
  return resolved;
}

const BASE_URL = sanitizeUrl(
  process.env.NEXT_PUBLIC_API_URL,
  "http://api.alfheim.loegien.localhost/api/v1/chat"
);

function getAuthToken(): string | null {
  if (typeof window === "undefined") return null;
  return sessionStorage.getItem("token_chat-frontend") || sessionStorage.getItem("alfheim_access_token");
}

function authHeaders(): HeadersInit {
  const token = getAuthToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export class ApiError extends Error {
  status: number;
  code: string;

  constructor(status: number, payload: ApiErrorPayload) {
    super(payload.message || payload.error || `Request failed with status ${status}`);
    this.status = status;
    this.code = payload.error || "unknown_error";
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...authHeaders(),
      ...init?.headers,
    },
  });

  if (!res.ok) {
    let payload: ApiErrorPayload = { error: "unknown_error", message: `Request failed with status ${res.status}` };
    try {
      payload = await res.json();
    } catch {
      // Non-JSON error body; keep the generic fallback.
    }
    throw new ApiError(res.status, payload);
  }

  if (res.status === 204) {
    return undefined as T;
  }
  return res.json() as Promise<T>;
}

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

export function listConversations(): Promise<Conversation[]> {
  return request<Conversation[]>("/conversations");
}

export function createConversation(payload: CreateConversationRequest): Promise<Conversation> {
  return request<Conversation>("/conversations", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function deleteConversation(id: string): Promise<void> {
  return request<void>(`/conversations/${id}`, { method: "DELETE" });
}

export function listMessages(conversationId: string): Promise<Message[]> {
  return request<Message[]>(`/conversations/${conversationId}/messages`);
}

export function postMessage(
  conversationId: string,
  content: string,
  attachmentIds?: string[]
): Promise<Message> {
  return request<Message>(`/conversations/${conversationId}/messages`, {
    method: "POST",
    body: JSON.stringify({ content, attachment_ids: attachmentIds }),
  });
}

export async function uploadAttachment(file: File): Promise<Attachment> {
  const formData = new FormData();
  formData.append("file", file);

  const res = await fetch(`${BASE_URL}/attachments`, {
    method: "POST",
    headers: {
      ...authHeaders(),
    },
    body: formData,
  });

  if (!res.ok) {
    let payload: ApiErrorPayload = { error: "upload_failed", message: `Upload failed with status ${res.status}` };
    try {
      payload = await res.json();
    } catch {
      // Non-JSON error body fallback
    }
    throw new ApiError(res.status, payload);
  }

  return res.json() as Promise<Attachment>;
}

export function streamAssistantReply(
  conversationId: string,
  handlers: StreamHandlers,
  signal?: AbortSignal
): Promise<void> {
  return sseStream(BASE_URL, authHeaders, conversationId, handlers, signal);
}
