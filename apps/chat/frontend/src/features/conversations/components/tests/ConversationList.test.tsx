import { render, screen, fireEvent } from "@testing-library/react";
import { vi, Mock } from "vitest";
import { ConversationList } from "../ConversationList";
import {
  useConversations,
  useCreateConversation,
  useDeleteConversation,
  useModelBlocks,
} from "@/features/conversations/services/conversationService";
import { createQueryWrapper } from "@/tests/utils";

vi.mock("@/features/conversations/services/conversationService", () => ({
  useConversations: vi.fn(),
  useCreateConversation: vi.fn(),
  useDeleteConversation: vi.fn(),
  useModelBlocks: vi.fn(),
}));

describe("ConversationList", () => {
  const mockMutate = vi.fn();
  const mockDelete = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    ;(useCreateConversation as Mock).mockReturnValue({ mutate: mockMutate, isPending: false, isError: false });
    ;(useDeleteConversation as Mock).mockReturnValue({ mutate: mockDelete, isPending: false, isError: false });
    window.confirm = vi.fn(() => true);
  });

  it("shows the empty state when there are no conversations and no models", () => {
    ;(useConversations as Mock).mockReturnValue({ data: [], isLoading: false });
    ;(useModelBlocks as Mock).mockReturnValue({ data: [] });

    const onOpenAddModel = vi.fn();
    render(<ConversationList selectedId={null} onSelect={vi.fn()} onOpenAddModel={onOpenAddModel} />, { wrapper: createQueryWrapper() });

    expect(screen.getByText("No conversations yet. Start a new one.")).toBeInTheDocument();
    expect(screen.getByText("No Model Configured")).toBeInTheDocument();

    fireEvent.click(screen.getByText("Add model block"));
    expect(onOpenAddModel).toHaveBeenCalled();
  });

  it("lists conversations, selects and deletes them", () => {
    ;(useConversations as Mock).mockReturnValue({
      data: [{ id: "c1", title: "First chat", owner_user_id: "u1", created_at: "", updated_at: "" }],
      isLoading: false,
    });
    ;(useModelBlocks as Mock).mockReturnValue({ data: [] });

    const onSelect = vi.fn();
    render(<ConversationList selectedId="c1" onSelect={onSelect} />, { wrapper: createQueryWrapper() });

    fireEvent.click(screen.getByText("First chat"));
    expect(onSelect).toHaveBeenCalledWith("c1");

    fireEvent.click(screen.getByRole("button", { name: "Delete conversation" }));
    expect(window.confirm).toHaveBeenCalledWith("Really delete this conversation?");
    expect(mockDelete).toHaveBeenCalledWith("c1", expect.anything());
  });

  it("labels the picker as the model for new conversations and creates one with it", () => {
    ;(useConversations as Mock).mockReturnValue({ data: [], isLoading: false });
    ;(useModelBlocks as Mock).mockReturnValue({
      data: [
        { id: "mb-1", display_name: "Local Llama" },
        { id: "mb-2", display_name: "GPT-4o" },
      ],
    });

    render(<ConversationList selectedId={null} onSelect={vi.fn()} />, { wrapper: createQueryWrapper() });

    const picker = screen.getByRole("combobox", { name: "Model for new conversations" });
    fireEvent.change(picker, { target: { value: "mb-2" } });
    fireEvent.click(screen.getByText("New conversation"));

    expect(mockMutate).toHaveBeenCalledWith({ model_block_id: "mb-2" }, expect.anything());
  });

  it("surfaces load, create and delete failures", () => {
    ;(useConversations as Mock).mockReturnValue({ data: undefined, isLoading: false, isError: true });
    ;(useModelBlocks as Mock).mockReturnValue({ data: [{ id: "mb-1", display_name: "Local Llama" }] });
    ;(useCreateConversation as Mock).mockReturnValue({ mutate: mockMutate, isPending: false, isError: true });
    ;(useDeleteConversation as Mock).mockReturnValue({ mutate: mockDelete, isPending: false, isError: true });

    render(<ConversationList selectedId={null} onSelect={vi.fn()} />, { wrapper: createQueryWrapper() });

    expect(screen.getByText("Conversations could not be loaded.")).toBeInTheDocument();
    expect(screen.getByText("The conversation could not be started.")).toBeInTheDocument();
    expect(screen.getByText("The conversation could not be deleted.")).toBeInTheDocument();
  });

  it("truncates very long conversation titles and model names", () => {
    const longTitle = "Very long conversation title ".repeat(30).trim();
    ;(useConversations as Mock).mockReturnValue({
      data: [{ id: "c1", title: longTitle, owner_user_id: "u1", created_at: "", updated_at: "" }],
      isLoading: false,
    });
    ;(useModelBlocks as Mock).mockReturnValue({ data: [{ id: "mb-1", display_name: "M".repeat(200) }] });

    render(<ConversationList selectedId={null} onSelect={vi.fn()} />, { wrapper: createQueryWrapper() });

    const titleButton = screen.getByTitle(longTitle);
    expect(titleButton.className).toContain("truncate");
    expect(titleButton.className).toContain("min-w-0");
    expect(screen.getByRole("combobox").className).toContain("min-w-0");
  });
});
