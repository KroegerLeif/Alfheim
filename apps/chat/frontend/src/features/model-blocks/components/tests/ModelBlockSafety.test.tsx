import { render, screen, fireEvent } from "@testing-library/react";
import { vi, Mock } from "vitest";
import { ModelBlockCard } from "../ModelBlockCard";
import { ModelBlockFormModal } from "../ModelBlockFormModal";
import type { ModelBlock } from "../../types";
import { useTriggerHealthCheck, useDiscoverModels } from "../../services/modelBlockService";
import { createQueryWrapper } from "@/tests/utils";

vi.mock("../../services/modelBlockService", () => ({
  useModelBlocks: vi.fn(),
  useCreateModelBlock: vi.fn(),
  useUpdateModelBlock: vi.fn(),
  useDeleteModelBlock: vi.fn(),
  useTriggerHealthCheck: vi.fn(),
  useDiscoverModels: vi.fn(),
}));

describe("bootstrap and base URL change safety", () => {
  const bootstrapModel: ModelBlock = {
    id: "mb-boot",
    owner_user_id: "system",
    visibility: "private",
    provider_type: "ollama",
    display_name: "Bootstrap ollama",
    model_identifier: "llama3",
    has_api_key: true,
    config: {},
    health_status: "ok",
    is_bootstrap: true,
    is_owner: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  const keyedModel: ModelBlock = {
    ...bootstrapModel,
    id: "mb-keyed",
    is_bootstrap: false,
    provider_type: "openai_compatible",
    base_url: "https://api.example.com/v1",
  };

  beforeEach(() => {
    ;(useTriggerHealthCheck as Mock).mockReturnValue({ mutate: vi.fn(), isPending: false });
    ;(useDiscoverModels as Mock).mockReturnValue({ mutate: vi.fn(), isPending: false });
  });

  it("never offers edit or delete for environment-managed blocks and explains why", () => {
    render(<ModelBlockCard model={bootstrapModel} onEdit={vi.fn()} onDelete={vi.fn()} />, { wrapper: createQueryWrapper() });

    expect(screen.queryByLabelText("Edit model block")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Delete model block")).not.toBeInTheDocument();
    expect(screen.getByText(/Managed by the server environment/)).toBeInTheDocument();
  });

  it("drops the stored key when the URL of a keyed block changes without a new key", () => {
    const onSubmit = vi.fn();
    render(<ModelBlockFormModal isOpen={true} model={keyedModel} onClose={vi.fn()} onSubmit={onSubmit} isPending={false} />);

    fireEvent.change(screen.getByDisplayValue("https://api.example.com/v1"), { target: { value: "https://other.example.com/v1" } });
    expect(screen.getByRole("status")).toHaveTextContent("Changing the URL removes the stored API key");

    fireEvent.click(screen.getByText("Save"));
    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({
        id: "mb-keyed",
        payload: expect.objectContaining({ base_url: "https://other.example.com/v1", clear_api_key: true }),
      }),
    );
  });

  it("keeps the stored key when the URL is unchanged", () => {
    const onSubmit = vi.fn();
    render(<ModelBlockFormModal isOpen={true} model={keyedModel} onClose={vi.fn()} onSubmit={onSubmit} isPending={false} />);

    expect(screen.queryByRole("status")).not.toBeInTheDocument();
    fireEvent.click(screen.getByText("Save"));
    expect(onSubmit.mock.calls[0][0].payload.clear_api_key).toBeUndefined();
  });
});
