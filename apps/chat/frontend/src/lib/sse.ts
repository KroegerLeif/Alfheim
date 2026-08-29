import type { ApiErrorPayload } from "@/features/conversations/types";

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
 * using EventSource.
 */
export async function streamAssistantReply(
  baseUrl: string,
  authHeaderProvider: () => HeadersInit,
  conversationId: string,
  handlers: StreamHandlers,
  signal?: AbortSignal
): Promise<void> {
  let res: Response;
  try {
    res = await fetch(`${baseUrl}/conversations/${conversationId}/stream`, {
      headers: { ...authHeaderProvider() },
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
    return;
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
      break;
  }
}
