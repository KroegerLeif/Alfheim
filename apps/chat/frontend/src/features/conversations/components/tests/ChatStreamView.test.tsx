import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";
import { vi, Mock } from "vitest";
import { ChatStreamView } from "../ChatStreamView";
import {
  useConversations,
  useCreateConversation,
  useMessages,
  useModelBlocks,
} from "@/features/conversations/services/conversationService";
import { postMessage, streamAssistantReply, uploadAttachment, type StreamHandlers } from "@/lib/api";
import { createQueryWrapper } from "@/tests/utils";

vi.mock("@/features/conversations/services/conversationService", () => ({
  useConversations: vi.fn(),
  useMessages: vi.fn(),
  useModelBlocks: vi.fn(),
  useCreateConversation: vi.fn(),
}));

vi.mock("@/lib/api", () => ({
  postMessage: vi.fn(),
  streamAssistantReply: vi.fn(),
  uploadAttachment: vi.fn(),
}));

const conversation = (id: string, modelBlockId?: string) => ({
  id,
  owner_user_id: "u1",
  model_block_id: modelBlockId,
  created_at: "",
  updated_at: "",
});

function sendMessage(text: string) {
  fireEvent.change(screen.getByPlaceholderText("Type a message..."), { target: { value: text } });
  fireEvent.click(screen.getByRole("button", { name: "Send" }));
}

describe("ChatStreamView", () => {
  const mockCreateMutateAsync = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    ;(useModelBlocks as Mock).mockReturnValue({
      data: [
        { id: "mb-1", display_name: "Local Llama" },
        { id: "mb-2", display_name: "GPT-4o" },
      ],
    });
    ;(useConversations as Mock).mockReturnValue({ data: [conversation("c1", "mb-1")] });
    ;(useCreateConversation as Mock).mockReturnValue({
      mutateAsync: mockCreateMutateAsync,
      isPending: false,
    });
    ;(useMessages as Mock).mockReturnValue({ data: [], isLoading: false, isError: false });
    ;(postMessage as Mock).mockResolvedValue({ id: "m1", role: "user", content: "hi" });
    global.URL.createObjectURL = vi.fn().mockReturnValue("blob:mock-url");
    global.URL.revokeObjectURL = vi.fn();
  });

  it("shows a placeholder when no conversation is selected", () => {
    render(<ChatStreamView conversationId={null} />, { wrapper: createQueryWrapper() });

    expect(screen.getByText("Select a conversation on the left or start a new one.")).toBeInTheDocument();
  });

  it("renders existing messages with image attachments", () => {
    ;(useMessages as Mock).mockReturnValue({
      data: [
        {
          id: "m1",
          conversation_id: "c1",
          role: "user",
          content: "Check this photo",
          attachments: [
            {
              id: "att-1",
              storage_key: "users/u1/chat/img.png",
              mime_type: "image/png",
              size_bytes: 1024,
              url: "http://localhost/storage/users/u1/chat/img.png",
            },
          ],
          created_at: "",
        },
        { id: "m2", conversation_id: "c1", role: "assistant", content: "Looks good!", created_at: "" },
      ],
      isLoading: false,
      isError: false,
    });

    render(<ChatStreamView conversationId="c1" />, { wrapper: createQueryWrapper() });

    expect(screen.getByText("Check this photo")).toBeInTheDocument();
    expect(screen.getByText("Looks good!")).toBeInTheDocument();
    const img = screen.getByRole("img", { name: "Attachment" });
    expect(img).toHaveAttribute("src", "http://localhost/storage/users/u1/chat/img.png");
  });

  it("shows the open conversation's own model, not the sidebar choice for new conversations", () => {
    const { rerender } = render(<ChatStreamView conversationId="c1" selectedModelBlockId="mb-2" />, {
      wrapper: createQueryWrapper(),
    });

    expect(screen.getByText("Local Llama")).toBeInTheDocument();
    expect(screen.queryByText("GPT-4o")).not.toBeInTheDocument();

    ;(useConversations as Mock).mockReturnValue({ data: [conversation("c1", "mb-deleted")] });
    rerender(<ChatStreamView conversationId="c1" selectedModelBlockId="mb-2" />);
    expect(screen.getByText("Model unavailable")).toBeInTheDocument();
  });

  it("posts the message and streams the assistant reply as deltas arrive", async () => {
    ;(streamAssistantReply as Mock).mockImplementation(async (_id, handlers: StreamHandlers) => {
      handlers.onDelta("Hel");
      handlers.onDelta("lo");
      handlers.onDone({ total_tokens: 2 });
    });

    render(<ChatStreamView conversationId="c1" />, { wrapper: createQueryWrapper() });
    sendMessage("hi");

    await waitFor(() => expect(postMessage).toHaveBeenCalledWith("c1", "hi", []));
    await waitFor(() => expect(streamAssistantReply).toHaveBeenCalled());
  });

  it("uploads an image and sends attachment IDs with the message", async () => {
    ;(uploadAttachment as Mock).mockResolvedValue({ id: "att-uploaded", url: "http://localhost/storage/att.png" });
    ;(streamAssistantReply as Mock).mockResolvedValue(undefined);

    const { container } = render(<ChatStreamView conversationId="c1" />, { wrapper: createQueryWrapper() });

    const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File(["dummy"], "photo.png", { type: "image/png" });
    fireEvent.change(fileInput, { target: { files: [file] } });

    await waitFor(() => expect(uploadAttachment).toHaveBeenCalledWith(file));
    expect(await screen.findByText("photo.png")).toBeInTheDocument();

    sendMessage("hello with image");
    await waitFor(() => expect(postMessage).toHaveBeenCalledWith("c1", "hello with image", ["att-uploaded"]));
  });

  it("shows a localized stream error with the backend detail and retries the stream", async () => {
    ;(streamAssistantReply as Mock)
      .mockImplementationOnce(async (_id, handlers: StreamHandlers) => {
        handlers.onError({ kind: "server", detail: "boom" });
      })
      .mockImplementationOnce(async (_id, handlers: StreamHandlers) => {
        handlers.onDone();
      });

    render(<ChatStreamView conversationId="c1" />, { wrapper: createQueryWrapper() });
    sendMessage("hi");

    const alert = await screen.findByRole("alert");
    expect(within(alert).getByText("Failed to stream the reply")).toBeInTheDocument();
    expect(within(alert).getByText("boom")).toBeInTheDocument();

    fireEvent.click(within(alert).getByRole("button", { name: "Retry" }));
    await waitFor(() => expect(streamAssistantReply).toHaveBeenCalledTimes(2));
    expect(postMessage).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(screen.queryByRole("alert")).not.toBeInTheDocument());
  });

  it("resends the same message when posting it failed", async () => {
    ;(postMessage as Mock).mockRejectedValueOnce(new Error("offline"));
    ;(streamAssistantReply as Mock).mockResolvedValue(undefined);

    render(<ChatStreamView conversationId="c1" />, { wrapper: createQueryWrapper() });
    sendMessage("please retry me");

    const alert = await screen.findByRole("alert");
    expect(within(alert).getByText("Failed to send the message")).toBeInTheDocument();

    fireEvent.click(within(alert).getByRole("button", { name: "Retry" }));
    await waitFor(() => expect(postMessage).toHaveBeenCalledTimes(2));
    expect(postMessage).toHaveBeenLastCalledWith("c1", "please retry me", []);
  });

  it("stops an in-flight reply and offers to retry it", async () => {
    let signal: AbortSignal | undefined;
    ;(streamAssistantReply as Mock).mockImplementation(
      (_id, handlers: StreamHandlers, s?: AbortSignal) =>
        new Promise<void>((resolve) => {
          signal = s;
          handlers.onDelta("partial answer");
          s?.addEventListener("abort", () => resolve());
        })
    );

    render(<ChatStreamView conversationId="c1" />, { wrapper: createQueryWrapper() });
    sendMessage("long question");

    expect(await screen.findByText("partial answer")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Stop the reply" }));

    expect(signal?.aborted).toBe(true);
    expect(await screen.findByText("Reply stopped.")).toBeInTheDocument();
    expect(screen.queryByText("partial answer")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Send" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    await waitFor(() => expect(streamAssistantReply).toHaveBeenCalledTimes(2));
  });

  it("aborts a running stream when another conversation is opened", async () => {
    let signal: AbortSignal | undefined;
    ;(streamAssistantReply as Mock).mockImplementation(
      (_id, _handlers: StreamHandlers, s?: AbortSignal) =>
        new Promise<void>((resolve) => {
          signal = s;
          s?.addEventListener("abort", () => resolve());
        })
    );
    ;(useConversations as Mock).mockReturnValue({ data: [conversation("c1", "mb-1"), conversation("c2", "mb-2")] });

    const { rerender } = render(<ChatStreamView conversationId="c1" />, { wrapper: createQueryWrapper() });
    sendMessage("question");
    expect(await screen.findByRole("button", { name: "Stop the reply" })).toBeInTheDocument();

    rerender(<ChatStreamView conversationId="c2" />);

    await waitFor(() => expect(signal?.aborted).toBe(true));
    expect(screen.getByRole("button", { name: "Send" })).toBeInTheDocument();
    expect(screen.queryByText("Reply stopped.")).not.toBeInTheDocument();
    expect(screen.getByText("GPT-4o")).toBeInTheDocument();
  });

  it("shows live tool calls while the reply streams", async () => {
    ;(streamAssistantReply as Mock).mockImplementation(
      (_id, handlers: StreamHandlers) =>
        new Promise<void>(() => {
          handlers.onToolCall?.({ id: "call_1", name: "get_stock", arguments: { item: "milk" } });
        })
    );

    render(<ChatStreamView conversationId="c1" />, { wrapper: createQueryWrapper() });
    sendMessage("milk?");

    expect(await screen.findByText("get_stock")).toBeInTheDocument();
    expect(screen.getByText("Running")).toBeInTheDocument();
  });

  it("automatically creates a conversation with the chosen model when sending from the landing state", async () => {
    mockCreateMutateAsync.mockResolvedValue(conversation("new-convo-1", "mb-2"));
    ;(useConversations as Mock).mockReturnValue({ data: [] });
    ;(streamAssistantReply as Mock).mockImplementation(async (_id, handlers: StreamHandlers) => {
      handlers.onDelta("AI Answer");
      handlers.onDone({ total_tokens: 2 });
    });

    const onConversationCreated = vi.fn();
    render(
      <ChatStreamView conversationId={null} selectedModelBlockId="mb-2" onConversationCreated={onConversationCreated} />,
      { wrapper: createQueryWrapper() }
    );

    expect(screen.getByText("Hello! I'm ALFI.")).toBeInTheDocument();
    expect(screen.getByText("GPT-4o")).toBeInTheDocument();

    sendMessage("first question");

    await waitFor(() => expect(mockCreateMutateAsync).toHaveBeenCalledWith({ model_block_id: "mb-2" }));
    await waitFor(() => expect(onConversationCreated).toHaveBeenCalledWith("new-convo-1"));
    await waitFor(() => expect(postMessage).toHaveBeenCalledWith("new-convo-1", "first question", []));
    await waitFor(() => expect(streamAssistantReply).toHaveBeenCalled());
    // The new conversation's header shows the model it was created with.
    expect(await screen.findByText("GPT-4o")).toBeInTheDocument();
  });
});
