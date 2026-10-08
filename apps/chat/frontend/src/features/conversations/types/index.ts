// Mirrors the Go backend's response DTOs (apps/chat/backend/internal/features/{modelblocks,conversations,attachments}).

export type ModelBlockVisibility = "private" | "shared";
export type ModelBlockHealthStatus = "ok" | "unreachable" | "auth_invalid" | "unknown";

export interface ModelBlock {
  id: string;
  owner_user_id: string;
  household_id?: string;
  visibility: ModelBlockVisibility;
  provider_type: string;
  display_name: string;
  base_url?: string;
  model_identifier: string;
  has_api_key: boolean;
  config: Record<string, unknown>;
  health_status: ModelBlockHealthStatus;
  health_checked_at?: string;
  health_detail?: string;
  is_bootstrap: boolean;
  is_owner: boolean;
  created_at: string;
  updated_at: string;
}

export interface Conversation {
  id: string;
  owner_user_id: string;
  household_id?: string;
  source_app?: string;
  source_context?: unknown;
  model_block_id?: string;
  title?: string;
  created_at: string;
  updated_at: string;
}

export type MessageRole = "user" | "assistant" | "system" | "tool";

export interface AttachmentSummary {
  id: string;
  storage_key: string;
  mime_type: string;
  size_bytes: number;
  url: string;
}

export interface Attachment {
  id: string;
  message_id?: string;
  storage_key: string;
  mime_type: string;
  size_bytes: number;
  url: string;
  created_at: string;
}

export interface Message {
  id: string;
  conversation_id: string;
  role: MessageRole;
  content: string;
  attachments?: AttachmentSummary[];
  /**
   * Assistant messages: the tool calls the model requested, serialized by the Go
   * backend as `[{"ID", "ToolName", "Arguments"}]`. Tool messages: the result record
   * `{"tool_call_id", "tool_name", "is_error"}` (absent on rows written before it existed).
   */
  tool_calls?: unknown;
  token_usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number };
  created_at: string;
}

/** A tool call announced by the SSE `tool_call` event or stored on an assistant message. */
export interface ToolCallRequest {
  id: string;
  name: string;
  arguments: Record<string, unknown>;
}

export type ToolCallStatus = "running" | "done" | "error" | "no_result";

/** A tool call as rendered in the message list, with its result once known. */
export interface ToolCallView extends ToolCallRequest {
  status: ToolCallStatus;
  result?: string;
}

export interface CreateConversationRequest {
  model_block_id: string;
  source_app?: string;
  source_context?: unknown;
  title?: string;
}

export interface CreateMessageRequest {
  content: string;
  attachment_ids?: string[];
}

export interface ApiErrorPayload {
  error: string;
  message: string;
}
