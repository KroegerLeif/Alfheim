import { streamAssistantReply as sseStream, type StreamFailure, type StreamHandlers } from "@/lib/sse";
import { chatApi } from "./api/client";

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
  return sseStream(chatApi, conversationId, handlers, signal);
}
