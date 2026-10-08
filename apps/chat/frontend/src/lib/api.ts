import { streamAssistantReply as sseStream, type StreamFailure, type StreamHandlers } from "@/lib/sse";
import { BASE_URL, authHeaders } from "./api/client";

export type { StreamFailure, StreamHandlers };

export * from "./api/client";
export * from "./api/modelBlocks";
export * from "./api/conversations";
export * from "./api/attachments";

export function streamAssistantReply(
  conversationId: string,
  handlers: StreamHandlers,
  signal?: AbortSignal
): Promise<void> {
  return sseStream(BASE_URL, authHeaders, conversationId, handlers, signal);
}
