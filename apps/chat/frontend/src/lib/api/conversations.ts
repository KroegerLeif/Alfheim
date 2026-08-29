import type {
  Conversation,
  CreateConversationRequest,
  Message,
} from "@/features/conversations/types";
import { request } from "./client";

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
