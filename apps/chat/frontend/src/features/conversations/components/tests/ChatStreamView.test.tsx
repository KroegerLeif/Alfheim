import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { vi, Mock } from "vitest";
import { ChatStreamView } from "../ChatStreamView";
import { useMessages } from "@/features/conversations/services/conversationService";
import { postMessage, streamAssistantReply, uploadAttachment } from "@/lib/api";
import { createQueryWrapper } from "@/tests/utils";

vi.mock("@/features/conversations/services/conversationService", () => ({
  useMessages: vi.fn(),
}));

vi.mock("@/lib/api", () => ({
  postMessage: vi.fn(),
  streamAssistantReply: vi.fn(),
  uploadAttachment: vi.fn(),
}));

describe("ChatStreamView", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    global.URL.createObjectURL = vi.fn().mockReturnValue("blob:mock-url");
    global.URL.revokeObjectURL = vi.fn();
  });

  it("shows a placeholder when no conversation is selected", () => {
    ;(useMessages as Mock).mockReturnValue({ data: undefined, isLoading: false, isError: false });

    render(<ChatStreamView conversationId={null} />, { wrapper: createQueryWrapper() });

    expect(screen.getByText("noConversationSelected")).toBeInTheDocument();
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
    const img = screen.getByRole("img", { name: /attachment/i });
    expect(img).toHaveAttribute("src", "http://localhost/storage/users/u1/chat/img.png");
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
    fireEvent.click(screen.getByRole("button", { name: "send" }));

    await waitFor(() => expect(postMessage).toHaveBeenCalledWith("c1", "hi", []));
    await waitFor(() => expect(streamAssistantReply).toHaveBeenCalled());
  });

  it("uploads an image and sends attachment IDs with the message", async () => {
    ;(useMessages as Mock).mockReturnValue({ data: [], isLoading: false, isError: false });
    ;(uploadAttachment as Mock).mockResolvedValue({
      id: "att-uploaded",
      url: "http://localhost/storage/att.png",
    });
    ;(postMessage as Mock).mockResolvedValue({ id: "m1", role: "user", content: "hello with image" });
    ;(streamAssistantReply as Mock).mockResolvedValue(undefined);

    const { container } = render(<ChatStreamView conversationId="c1" />, { wrapper: createQueryWrapper() });

    const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File(["dummy"], "photo.png", { type: "image/png" });

    fireEvent.change(fileInput, { target: { files: [file] } });

    await waitFor(() => expect(uploadAttachment).toHaveBeenCalledWith(file));
    expect(await screen.findByText("photo.png")).toBeInTheDocument();

    fireEvent.change(screen.getByPlaceholderText("inputPlaceholder"), { target: { value: "hello with image" } });
    fireEvent.click(screen.getByRole("button", { name: "send" }));

    await waitFor(() => expect(postMessage).toHaveBeenCalledWith("c1", "hello with image", ["att-uploaded"]));
  });

  it("shows the streaming error message when the stream reports one", async () => {
    ;(useMessages as Mock).mockReturnValue({ data: [], isLoading: false, isError: false });
    ;(postMessage as Mock).mockResolvedValue({ id: "m1", role: "user", content: "hi" });
    ;(streamAssistantReply as Mock).mockImplementation(async (_id, handlers) => {
      handlers.onError("boom");
    });

    render(<ChatStreamView conversationId="c1" />, { wrapper: createQueryWrapper() });

    fireEvent.change(screen.getByPlaceholderText("inputPlaceholder"), { target: { value: "hi" } });
    fireEvent.click(screen.getByRole("button", { name: "send" }));

    await waitFor(() => expect(screen.getByText("boom")).toBeInTheDocument());
  });
});
