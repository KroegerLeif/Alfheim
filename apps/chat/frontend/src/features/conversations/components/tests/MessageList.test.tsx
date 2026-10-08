import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { MessageList } from "../MessageList";
import type { Message } from "@/features/conversations/types";
import { setTestLocale } from "@/tests/locale";

const history: Message[] = [
  { id: "u1", conversation_id: "c1", role: "user", content: "How much milk?", created_at: "" },
  {
    id: "a1",
    conversation_id: "c1",
    role: "assistant",
    content: "",
    tool_calls: [{ ID: "call_1", ToolName: "get_stock", Arguments: { item: "milk", authorization: "Bearer secret-token" } }],
    created_at: "",
  },
  {
    id: "t1",
    conversation_id: "c1",
    role: "tool",
    content: "3 liters of milk",
    tool_calls: { tool_call_id: "call_1", tool_name: "get_stock", is_error: false },
    created_at: "",
  },
  { id: "a2", conversation_id: "c1", role: "assistant", content: "You have 3 liters.", created_at: "" },
];

const baseProps = { isLoading: false, isError: false, isStreaming: false, streamingText: "", liveToolCalls: [] };

describe("MessageList", () => {
  it("renders stored tool calls as collapsed entries instead of assistant speech", () => {
    render(<MessageList {...baseProps} messages={history} />);

    expect(screen.getByRole("group", { name: "Tools used: 1" })).toBeInTheDocument();
    const summary = screen.getByText("get_stock");
    expect(screen.getByText("Done")).toBeInTheDocument();
    const details = summary.closest("details");
    expect(details).not.toHaveAttribute("open");

    fireEvent.click(summary);
    expect(screen.getByText("Arguments")).toBeInTheDocument();
    expect(screen.getByText("Result")).toBeInTheDocument();
    expect(details?.textContent).toContain("3 liters of milk");
    expect(details?.textContent).not.toContain("secret-token");
    expect(screen.getByText("You have 3 liters.")).toBeInTheDocument();
  });

  it("localizes tool call status", () => {
    setTestLocale("de");
    render(<MessageList {...baseProps} messages={history} />);
    expect(screen.getByText("Erledigt")).toBeInTheDocument();
    expect(screen.getByRole("group", { name: "Verwendete Werkzeuge: 1" })).toBeInTheDocument();
  });

  it("wraps very long unbroken content instead of overflowing", () => {
    const longWord = "https://example.com/" + "a".repeat(600);
    render(
      <MessageList
        {...baseProps}
        messages={[{ id: "u1", conversation_id: "c1", role: "user", content: longWord, created_at: "" }]}
        isStreaming
        streamingText={"b".repeat(600)}
        liveToolCalls={[{ id: "call_9", name: "tool_" + "x".repeat(300), arguments: {}, status: "running" }]}
      />
    );

    const bubble = screen.getByText(longWord).closest(".min-w-0");
    expect(bubble?.className).toContain("[overflow-wrap:anywhere]");
    expect(screen.getByText("b".repeat(600)).className).toContain("[overflow-wrap:anywhere]");
    expect(screen.getByText("tool_" + "x".repeat(300)).className).toContain("truncate");
    expect(screen.getByText("Running")).toBeInTheDocument();
  });

  it("reports load failures", () => {
    render(<MessageList {...baseProps} messages={undefined} isError />);
    expect(screen.getByText("Failed to load messages.")).toBeInTheDocument();
  });
});
