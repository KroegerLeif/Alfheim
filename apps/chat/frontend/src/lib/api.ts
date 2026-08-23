import type {
  ApiErrorPayload,
  Conversation,
  CreateConversationRequest,
  Message,
  ModelBlock,
} from "@/features/conversations/types";

// Sanitize and resolve the API base URL, mirroring the pattern used by other
// alfheim frontends (see apps/pantry/frontend/src/core/api.ts).
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
      // Non-JSON error body; keep the generic fallback above.
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

export function postMessage(conversationId: string, content: string): Promise<Message> {
  return request<Message>(`/conversations/${conversationId}/messages`, {
    method: "POST",
    body: JSON.stringify({ content }),
  });
}

export interface StreamHandlers {
  onDelta: (text: string) => void;
  onDone: (usage?: unknown) => void;
  onError: (message: string) => void;
}

/**
 * Streams the assistant's reply for a conversation as Server-Sent Events.
 *
 * The native EventSource API cannot send an Authorization header, but the backend
 * requires a bearer JWT on every request (including SSE), so this reads the
 * `text/event-stream` response body manually via fetch()'s ReadableStream instead of
 * using EventSource. Frames are separated by a blank line, each with an `event:` and
 * a `data:` line, matching the framing written by the Go handler
 * (apps/chat/backend/internal/features/conversations/handler.go's writeSSEChunk).
 */
export async function streamAssistantReply(
  conversationId: string,
  handlers: StreamHandlers,
  signal?: AbortSignal
): Promise<void> {
  let res: Response;
  try {
    res = await fetch(`${BASE_URL}/conversations/${conversationId}/stream`, {
      headers: { ...authHeaders() },
      signal,
    });
  } catch (err) {
    handlers.onError(err instanceof Error ? err.message : "Failed to reach the chat backend");
    return;
  }

  if (!res.ok || !res.body) {
    let message = `Failed to open stream (status ${res.status})`;
    try {
      const payload: ApiErrorPayload = await res.json();
      message = payload.message || message;
    } catch {
      // ignore, keep generic message
    }
    handlers.onError(message);
    return;
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      let separatorIndex: number;
      while ((separatorIndex = buffer.indexOf("\n\n")) !== -1) {
        const rawFrame = buffer.slice(0, separatorIndex);
        buffer = buffer.slice(separatorIndex + 2);
        dispatchSSEFrame(rawFrame, handlers);
      }
    }
  } catch (err) {
    if (!(err instanceof DOMException && err.name === "AbortError")) {
      handlers.onError(err instanceof Error ? err.message : "Stream reading failed");
    }
  }
}

function dispatchSSEFrame(rawFrame: string, handlers: StreamHandlers): void {
  const eventMatch = rawFrame.match(/^event: (.+)$/m);
  const dataMatch = rawFrame.match(/^data: (.+)$/m);
  const eventType = eventMatch?.[1] ?? "message";
  const rawData = dataMatch?.[1] ?? "{}";

  let data: Record<string, unknown>;
  try {
    data = JSON.parse(rawData);
  } catch {
    return; // Ignore malformed frames rather than crashing the stream reader.
  }

  switch (eventType) {
    case "delta":
      handlers.onDelta(typeof data.text === "string" ? data.text : "");
      break;
    case "done":
      handlers.onDone(data.usage);
      break;
    case "error":
      handlers.onError(typeof data.message === "string" ? data.message : "Unknown streaming error");
      break;
    default:
      // "tool_call" and any future event types are ignored by this Phase-3 view;
      // the MCP bridge phase will render them.
      break;
  }
}
