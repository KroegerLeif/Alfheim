export type AlfiStatus = 'idle' | 'thinking' | 'tool_calling' | 'streaming';

export interface ChatWidgetContext {
  sourceApp: string;
  entityType?: string;
  entityId?: string;
  entityData?: Record<string, unknown>;
}

export interface ChatWidgetProps {
  isOpen: boolean;
  onClose: () => void;
  authToken?: string;
  apiBaseUrl?: string;
  context?: ChatWidgetContext;
  householdId?: string;
}

export interface AttachmentSummary {
  id: string;
  storage_key?: string;
  mime_type?: string;
  size_bytes?: number;
  url: string;
}

export interface WidgetMessage {
  id: string;
  role: 'user' | 'assistant' | 'system' | 'tool';
  content: string;
  attachments?: AttachmentSummary[];
  tool_calls?: unknown;
  created_at?: string;
}

export interface StagedAttachment {
  id: string;
  file: File;
  previewUrl: string;
  uploadedId?: string;
  isUploading: boolean;
  error?: string;
}

export interface ModelBlock {
  id: string;
  display_name: string;
  is_active?: boolean;
}

export interface ConversationResponse {
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

export interface StreamHandlers {
  onDelta: (text: string) => void;
  onToolCall?: (toolCall: { name?: string; ToolName?: string; tool_name?: string; arguments?: unknown }) => void;
  onDone: (usage?: unknown) => void;
  onError: (message: string) => void;
}
