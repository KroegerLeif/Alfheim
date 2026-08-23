import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { vi, Mock } from "vitest";
import { ChatStreamView } from "../ChatStreamView";
import { useMessages } from "@/features/conversations/services/conversationService";
import { postMessage, streamAssistantReply } from "@/lib/api";
import { createQueryWrapper } from "@/tests/utils";

vi.mock("@/features/conversations/services/conversationService", () => ({
  useMessages: vi.fn(),
}));

vi.mock("@/lib/api", () => ({
  postMessage: vi.fn(),
  streamAssistantReply: vi.fn(),
}));

describe("ChatStreamView", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows a placeholder when no conversation is selected", () => {
    ;(useMessages as Mock).mockReturnValue({ data: undefined, isLoading: false, isError: false });

    render(<ChatStreamView conversationId={null} />, { wrapper: createQueryWrapper() });

    expect(screen.getByText("noConversationSelected")).toBeInTheDocument();
  });

  it("renders existing messages", () => {
    ;(useMessages as Mock).mockReturnValue({
      data: [
        { id: "m1", conversation_id: "c1", role: "user", content: "Hi there", created_at: "" },
        { id: "m2", conversation_id: "c1", role: "assistant", content: "Hello!", created_at: "" },
      ],
      isLoading: false,
      isError: false,
    });

    render(<ChatStreamView conversationId="c1" />, { wrapper: createQueryWrapper() });

    expect(screen.getByText("Hi there")).toBeInTheDocument();
    expect(screen.getByText("Hello!")).toBeInTheDocument();
  });

  it("posts the message and streams the assistant reply as deltas arrive", async () => {
    ;(useMessages as Mock).mockReturnValue({ data: [], isLoading: false, isError: false });
    ;(postMessage as Mock).mockResolvedValue({ id: "m1", role: "user", content: "hi" });
    ;(streamAssistantReply as Mock).mockImplementation(async (_id, handlers) => {
      handlers.onDelta("Hel");
      handlers.onDelta("lo");
      handlers.onDone({ total_tokens: 2 });
    });

    render(<ChatStreamView conversationId="c1" />, { wrapper: createQueryWrapper() });

    const input = screen.getByPlaceholderText("inputPlaceholder");
    fireEvent.change(input, { target: { value: "hi" } });
    fireEvent.click(screen.getByText("send"));

    await waitFor(() => expect(postMessage).toHaveBeenCalledWith("c1", "hi"));
    await waitFor(() => expect(streamAssistantReply).toHaveBeenCalled());
  });

  it("shows the streaming error message when the stream reports one", async () => {
    ;(useMessages as Mock).mockReturnValue({ data: [], isLoading: false, isError: false });
    ;(postMessage as Mock).mockResolvedValue({ id: "m1", role: "user", content: "hi" });
    ;(streamAssistantReply as Mock).mockImplementation(async (_id, handlers) => {
      handlers.onError("boom");
    });

    render(<ChatStreamView conversationId="c1" />, { wrapper: createQueryWrapper() });

    fireEvent.change(screen.getByPlaceholderText("inputPlaceholder"), { target: { value: "hi" } });
    fireEvent.click(screen.getByText("send"));

    await waitFor(() => expect(screen.getByText("boom")).toBeInTheDocument());
  });
});
