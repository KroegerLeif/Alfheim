import { render, screen, fireEvent } from "@testing-library/react";
import { vi, Mock } from "vitest";
import { ModelBlockCard } from "../ModelBlockCard";
import { ModelBlockFormModal } from "../ModelBlockFormModal";
import { ModelBlockManagementView } from "../ModelBlockManagementView";
import type { ModelBlock } from "../../types";
import {
  useModelBlocks,
  useCreateModelBlock,
  useUpdateModelBlock,
  useDeleteModelBlock,
  useTriggerHealthCheck,
} from "../../services/modelBlockService";
import { createQueryWrapper } from "@/tests/utils";

vi.mock("../../services/modelBlockService", () => ({
  useModelBlocks: vi.fn(),
  useCreateModelBlock: vi.fn(),
  useUpdateModelBlock: vi.fn(),
  useDeleteModelBlock: vi.fn(),
  useTriggerHealthCheck: vi.fn(),
}));

describe("ModelBlockCard", () => {
  const mockTriggerHealth = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    ;(useTriggerHealthCheck as Mock).mockReturnValue({
      mutate: mockTriggerHealth,
      isPending: false,
    });
  });

  const sharedModel: ModelBlock = {
    id: "mb-shared",
    owner_user_id: "user-owner",
    household_id: "hh-1",
    visibility: "shared",
    provider_type: "ollama",
    display_name: "Shared Llama",
    model_identifier: "llama3.1:8b",
    has_api_key: false,
    config: {},
    health_status: "ok",
    is_bootstrap: false,
    is_owner: false,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  const ownedModel: ModelBlock = {
    id: "mb-owned",
    owner_user_id: "user-current",
    household_id: "hh-1",
    visibility: "private",
    provider_type: "openai_compatible",
    display_name: "My Private GPT",
    model_identifier: "gpt-4o",
    has_api_key: true,
    config: {},
    health_status: "ok",
    is_bootstrap: false,
    is_owner: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  it("renders shared badge and hides edit/delete for non-owner", () => {
    render(
      <ModelBlockCard
        model={sharedModel}
        onEdit={vi.fn()}
        onDelete={vi.fn()}
      />,
      { wrapper: createQueryWrapper() }
    );

    expect(screen.getByText("Shared Llama")).toBeInTheDocument();
    expect(screen.getByText("sharedInHousehold")).toBeInTheDocument();
    expect(screen.queryByLabelText("editModelBlock")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("deleteModelBlock")).not.toBeInTheDocument();
  });

  it("renders private badge and shows edit/delete for owner", () => {
    const onEdit = vi.fn();
    const onDelete = vi.fn();

    render(
      <ModelBlockCard
        model={ownedModel}
        onEdit={onEdit}
        onDelete={onDelete}
      />,
      { wrapper: createQueryWrapper() }
    );

    expect(screen.getByText("My Private GPT")).toBeInTheDocument();
    expect(screen.getByText("privateModel")).toBeInTheDocument();

    const editBtn = screen.getByLabelText("editModelBlock");
    const deleteBtn = screen.getByLabelText("deleteModelBlock");
    expect(editBtn).toBeInTheDocument();
    expect(deleteBtn).toBeInTheDocument();

    fireEvent.click(editBtn);
    expect(onEdit).toHaveBeenCalledWith(ownedModel);
  });

  it("triggers health check on button click even for shared non-owned models", () => {
    render(
      <ModelBlockCard
        model={sharedModel}
        onEdit={vi.fn()}
        onDelete={vi.fn()}
      />,
      { wrapper: createQueryWrapper() }
    );

    fireEvent.click(screen.getByTitle("checkHealth"));
    expect(mockTriggerHealth).toHaveBeenCalledWith("mb-shared");
  });
});

describe("ModelBlockFormModal", () => {
  it("allows switching between private and shared visibility", () => {
    const onSubmit = vi.fn();
    render(
      <ModelBlockFormModal
        isOpen={true}
        onClose={vi.fn()}
        onSubmit={onSubmit}
        isPending={false}
      />
    );

    fireEvent.change(screen.getByPlaceholderText("z. B. Local Llama oder GPT-4o"), {
      target: { value: "New Model" },
    });
    fireEvent.change(screen.getByPlaceholderText("z. B. llama3.1:8b, gpt-4o, claude-3-5-sonnet"), {
      target: { value: "mistral:7b" },
    });

    // Toggle to shared
    fireEvent.click(screen.getByText("visibilityShared"));
    fireEvent.click(screen.getByText("save"));

    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({
        display_name: "New Model",
        model_identifier: "mistral:7b",
        visibility: "shared",
      })
    );
  });
});

describe("ModelBlockManagementView", () => {
  it("lists model blocks and opens form modal on add click", () => {
    ;(useModelBlocks as Mock).mockReturnValue({
      data: [
        {
          id: "mb-1",
          display_name: "Test Model",
          visibility: "private",
          provider_type: "ollama",
          model_identifier: "llama3",
          health_status: "ok",
          is_owner: true,
        },
      ],
      isLoading: false,
    });
    ;(useCreateModelBlock as Mock).mockReturnValue({ mutate: vi.fn(), isPending: false });
    ;(useUpdateModelBlock as Mock).mockReturnValue({ mutate: vi.fn(), isPending: false });
    ;(useDeleteModelBlock as Mock).mockReturnValue({ mutate: vi.fn() });
    ;(useTriggerHealthCheck as Mock).mockReturnValue({ mutate: vi.fn(), isPending: false });

    render(<ModelBlockManagementView isOpen={true} onClose={vi.fn()} />, {
      wrapper: createQueryWrapper(),
    });

    expect(screen.getByText("Test Model")).toBeInTheDocument();
    const addButtons = screen.getAllByText("addModelBlock");
    fireEvent.click(addButtons[0]);
    expect(screen.getByRole("heading", { name: "addModelBlock" })).toBeInTheDocument();
  });
});
