import { describe, expect, it } from "vitest";
import type { Message } from "@/features/conversations/types";
import { buildTimeline, formatToolArguments, parseToolCalls, redactText } from "../toolCalls";

const msg = (overrides: Partial<Message>): Message => ({
  id: "m",
  conversation_id: "c1",
  role: "assistant",
  content: "",
  created_at: "",
  ...overrides,
});

describe("parseToolCalls", () => {
  it("reads the Go field names and skips malformed entries", () => {
    expect(
      parseToolCalls([
        { ID: "call_1", ToolName: "get_stock", Arguments: { item: "milk" } },
        { id: "call_2", tool_name: "list_chores" },
        { ID: "call_3" },
        "garbage",
      ])
    ).toEqual([
      { id: "call_1", name: "get_stock", arguments: { item: "milk" } },
      { id: "call_2", name: "list_chores", arguments: {} },
    ]);
    expect(parseToolCalls(null)).toEqual([]);
  });
});

describe("buildTimeline", () => {
  it("attaches tool results to their call by id and hides them as speech", () => {
    const timeline = buildTimeline([
      msg({ id: "u", role: "user", content: "milk?" }),
      msg({
        id: "a1",
        tool_calls: [
          { ID: "call_1", ToolName: "get_stock", Arguments: {} },
          { ID: "call_2", ToolName: "get_expiring", Arguments: {} },
        ],
      }),
      msg({ id: "t2", role: "tool", content: "tool error: boom", tool_calls: { tool_call_id: "call_2", tool_name: "get_expiring", is_error: true } }),
      msg({ id: "t1", role: "tool", content: "3 liters", tool_calls: { tool_call_id: "call_1", tool_name: "get_stock", is_error: false } }),
      msg({ id: "a2", content: "You have 3 liters." }),
    ]);

    expect(timeline.map((item) => item.kind)).toEqual(["message", "tools", "message"]);
    const tools = timeline[1];
    expect(tools.kind === "tools" && tools.calls).toEqual([
      { id: "call_1", name: "get_stock", arguments: {}, status: "done", result: "3 liters" },
      { id: "call_2", name: "get_expiring", arguments: {}, status: "error", result: "tool error: boom" },
    ]);
  });

  it("pairs legacy tool rows without a record in order and keeps text of a tool-call turn", () => {
    const timeline = buildTimeline([
      msg({ id: "a1", content: "Let me check.", tool_calls: [{ ID: "call_1", ToolName: "get_stock" }, { ID: "call_2", ToolName: "get_more" }] }),
      msg({ id: "t1", role: "tool", content: "ok" }),
    ]);

    expect(timeline[0]).toMatchObject({ kind: "message", message: { content: "Let me check." } });
    expect(timeline[1].kind === "tools" && timeline[1].calls.map((c) => c.status)).toEqual(["done", "no_result"]);
  });

  it("shows a tool result without a matching call as its own entry", () => {
    const timeline = buildTimeline([msg({ id: "t1", role: "tool", content: "orphan", tool_calls: { tool_call_id: "x", tool_name: "get_stock", is_error: false } })]);
    expect(timeline).toEqual([
      { kind: "tools", id: "t1", calls: [{ id: "t1", name: "get_stock", arguments: {}, status: "done", result: "orphan" }] },
    ]);
  });
});

describe("redaction", () => {
  it("masks credential-like argument keys, bearer tokens and JWTs", () => {
    const formatted = formatToolArguments({
      item: "milk",
      api_key: "sk-live-123",
      nested: { accessToken: "abc", note: "Bearer abc.def.ghi" },
    });
    expect(formatted).toContain('"item": "milk"');
    expect(formatted).not.toContain("sk-live-123");
    expect(formatted).not.toContain("abc.def.ghi");
    expect(formatted).not.toContain('"abc"');

    expect(redactText("token eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxIn0.c2lnbmF0dXJl here")).toBe("token •••• here");
  });

  it("caps very long payloads", () => {
    const text = redactText("x".repeat(10_000));
    expect(text.length).toBeLessThan(4100);
    expect(text.endsWith("…")).toBe(true);
  });
});
