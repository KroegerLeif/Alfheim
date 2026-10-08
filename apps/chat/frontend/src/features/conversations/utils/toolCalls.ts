import type { Message, ToolCallRequest, ToolCallView } from "@/features/conversations/types";

/** One row of the rendered conversation: a chat bubble or a group of tool calls. */
export type TimelineItem =
  | { kind: "message"; message: Message }
  | { kind: "tools"; id: string; calls: ToolCallView[] };

const REDACTED = "••••";
const MAX_PAYLOAD_LENGTH = 4000;
const SENSITIVE_KEY = /token|secret|password|passwd|api[_-]?key|authorization|credential|cookie/i;
const BEARER_TOKEN = /\bBearer\s+[A-Za-z0-9\-._~+/]+=*/gi;
const JWT = /\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function stringField(record: Record<string, unknown>, ...keys: string[]): string {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string" && value) return value;
  }
  return "";
}

/**
 * Normalizes one tool call. The Go backend serializes `llm.ToolCallRequest` without JSON
 * tags (`ID`, `ToolName`, `Arguments`); snake_case keys are accepted as well.
 */
export function parseToolCall(raw: unknown): ToolCallRequest | null {
  if (!isRecord(raw)) return null;
  const name = stringField(raw, "ToolName", "tool_name", "name");
  if (!name) return null;
  const args = raw.Arguments ?? raw.arguments;
  return {
    id: stringField(raw, "ID", "id"),
    name,
    arguments: isRecord(args) ? args : {},
  };
}

/** Parses an assistant message's `tool_calls`; anything malformed is skipped. */
export function parseToolCalls(raw: unknown): ToolCallRequest[] {
  if (!Array.isArray(raw)) return [];
  return raw.map(parseToolCall).filter((call): call is ToolCallRequest => call !== null);
}

interface ToolResultRecord {
  toolCallId: string;
  toolName: string;
  isError: boolean;
}

function parseToolResultRecord(raw: unknown): ToolResultRecord | null {
  if (!isRecord(raw)) return null;
  return {
    toolCallId: stringField(raw, "tool_call_id"),
    toolName: stringField(raw, "tool_name"),
    isError: raw.is_error === true,
  };
}

function looksLikeError(content: string): boolean {
  return content.startsWith("tool error:");
}

/**
 * Turns the stored history into display rows: assistant tool-call turns become tool
 * groups, and tool result messages are attached to their call (by tool_call_id, or in
 * order for rows stored before results carried the id) instead of being shown as
 * assistant speech.
 */
export function buildTimeline(messages: Message[]): TimelineItem[] {
  const items: TimelineItem[] = [];
  const callsById = new Map<string, ToolCallView>();
  let lastGroup: ToolCallView[] = [];

  for (const message of messages) {
    if (message.role === "tool") {
      const record = parseToolResultRecord(message.tool_calls);
      const target =
        (record?.toolCallId ? callsById.get(record.toolCallId) : undefined) ??
        lastGroup.find((call) => call.status === "no_result");
      const status = record?.isError || looksLikeError(message.content) ? "error" : "done";
      if (target) {
        target.status = status;
        target.result = message.content;
      } else {
        const orphan: ToolCallView = { id: message.id, name: record?.toolName ?? "", arguments: {}, status, result: message.content };
        items.push({ kind: "tools", id: message.id, calls: [orphan] });
      }
      continue;
    }

    const calls = message.role === "assistant" ? parseToolCalls(message.tool_calls) : [];
    const hasBody = message.content.trim() !== "" || (message.attachments ?? []).length > 0;
    // A tool-call turn often has no text of its own; only render a bubble when it does.
    if (calls.length === 0 || hasBody) {
      items.push({ kind: "message", message });
    }
    if (calls.length > 0) {
      const views = calls.map<ToolCallView>((call) => ({ ...call, status: "no_result" }));
      views.forEach((view) => {
        if (view.id) callsById.set(view.id, view);
      });
      lastGroup = views;
      items.push({ kind: "tools", id: `${message.id}-tools`, calls: views });
    }
  }
  return items;
}

/** Recursively masks values stored under credential-like keys. */
export function redactSecrets(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(redactSecrets);
  if (isRecord(value)) {
    return Object.fromEntries(
      Object.entries(value).map(([key, inner]) => [key, SENSITIVE_KEY.test(key) ? REDACTED : redactSecrets(inner)]),
    );
  }
  if (typeof value === "string") return redactText(value);
  return value;
}

/** Masks bearer tokens and JWTs inside free text and caps its length. */
export function redactText(text: string): string {
  const masked = text.replace(BEARER_TOKEN, `Bearer ${REDACTED}`).replace(JWT, REDACTED);
  return masked.length > MAX_PAYLOAD_LENGTH ? `${masked.slice(0, MAX_PAYLOAD_LENGTH)}…` : masked;
}

/** Pretty-prints tool arguments with secrets masked. */
export function formatToolArguments(args: Record<string, unknown>): string {
  return redactText(JSON.stringify(redactSecrets(args), null, 2));
}
