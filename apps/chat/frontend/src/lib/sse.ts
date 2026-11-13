import type { ApiErrorPayload, ToolCallRequest } from "@/features/conversations/types";
import { parseToolCall } from "@/features/conversations/utils/toolCalls";
import type { ApiClient } from "@alfheim/shared";

/**
 * Why a stream failed. The UI shows a localized headline per kind; `detail` carries the
 * backend's (English, technical) message when there is one.
 */
export interface StreamFailure {
  kind: "network" | "http" | "read" | "server";
  status?: number;
  detail?: string;
}

export interface StreamHandlers {
  onDelta: (text: string) => void;
  onToolCall?: (call: ToolCallRequest) => void;
  onDone: (usage?: unknown) => void;
  onError: (failure: StreamFailure) => void;
}

function isAbort(err: unknown): boolean {
  return err instanceof DOMException && err.name === "AbortError";
}

/**
 * Streams the assistant's reply for a conversation as Server-Sent Events.
 *
 * The native EventSource API cannot send an Authorization header, but the backend
 * requires a bearer JWT on every request (including SSE), so this reads the
 * `text/event-stream` response body manually via fetch()'s ReadableStream instead of
 * using EventSource. The request goes through the injected API client (session headers,
 * household error reporting) as a streaming request, so no timeout cuts it off. Aborting `signal` ends the stream silently: no handler is called,
 * and the backend cancels the model request when the connection closes.
 */
export async function streamAssistantReply(
  client: ApiClient,
  conversationId: string,
  handlers: StreamHandlers,
  signal?: AbortSignal
): Promise<void> {
  let res: Response;
  try {
    res = await client.request(`/conversations/${conversationId}/stream`, {
      signal,
      stream: true,
      throwHttpErrors: false,
    });
  } catch (err) {
    if (!isAbort(err)) {
      handlers.onError({ kind: "network", detail: err instanceof Error ? err.message : undefined });
    }
    return;
  }

  if (!res.ok || !res.body) {
    let detail: string | undefined;
    try {
      const payload: ApiErrorPayload = await res.json();
      detail = payload.message || undefined;
    } catch {
      // The body is not JSON; the status code alone describes the failure.
      detail = undefined;
    }
    handlers.onError({ kind: "http", status: res.status, detail });
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
    if (!isAbort(err)) {
      handlers.onError({ kind: "read", detail: err instanceof Error ? err.message : undefined });
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
    return;
  }

  switch (eventType) {
    case "delta":
      handlers.onDelta(typeof data.text === "string" ? data.text : "");
      break;
    case "tool_call": {
      const call = parseToolCall(data);
      if (call) handlers.onToolCall?.(call);
      break;
    }
    case "done":
      handlers.onDone(data.usage);
      break;
    case "error":
      handlers.onError({ kind: "server", detail: typeof data.message === "string" ? data.message : undefined });
      break;
    default:
      break;
  }
}
