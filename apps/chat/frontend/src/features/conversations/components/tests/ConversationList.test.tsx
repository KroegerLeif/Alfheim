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

  beforeEach(() => {
    vi.clearAllMocks();
    ;(useCreateConversation as Mock).mockReturnValue({ mutate: mockMutate, isPending: false });
    ;(useDeleteConversation as Mock).mockReturnValue({ mutate: vi.fn() });
    window.confirm = vi.fn(() => true);
  });

  it("shows the empty state when there are no conversations", () => {
    ;(useConversations as Mock).mockReturnValue({ data: [], isLoading: false });
    ;(useModelBlocks as Mock).mockReturnValue({ data: [] });

    render(<ConversationList selectedId={null} onSelect={vi.fn()} />, { wrapper: createQueryWrapper() });

    expect(screen.getByText("noConversations")).toBeInTheDocument();
    expect(screen.getByText("noModelBlocks")).toBeInTheDocument();
  });

  it("lists conversations and invokes onSelect when clicked", () => {
    ;(useConversations as Mock).mockReturnValue({
      data: [{ id: "c1", title: "First chat", owner_user_id: "u1", created_at: "", updated_at: "" }],
      isLoading: false,
    });
    ;(useModelBlocks as Mock).mockReturnValue({ data: [] });

    const onSelect = vi.fn();
    render(<ConversationList selectedId={null} onSelect={onSelect} />, { wrapper: createQueryWrapper() });

    fireEvent.click(screen.getByText("First chat"));
    expect(onSelect).toHaveBeenCalledWith("c1");
  });

  it("creates a conversation with the selected model block", () => {
    ;(useConversations as Mock).mockReturnValue({ data: [], isLoading: false });
    ;(useModelBlocks as Mock).mockReturnValue({
      data: [{ id: "mb-1", display_name: "Local Llama" }],
    });

    render(<ConversationList selectedId={null} onSelect={vi.fn()} />, { wrapper: createQueryWrapper() });

    fireEvent.change(screen.getByRole("combobox"), { target: { value: "mb-1" } });
    fireEvent.click(screen.getByText("newConversation"));

    expect(mockMutate).toHaveBeenCalledWith({ model_block_id: "mb-1" }, expect.anything());
  });
});
