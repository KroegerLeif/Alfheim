import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen, fireEvent, waitFor } from "@testing-library/react";
import { makeHttpError, renderWithProviders } from "@/tests/renderWithProviders";
import * as providersApi from "../api/providersApi";
import { ProviderCard } from "../components/ProviderCard";
import { ProviderFormModal } from "../components/ProviderFormModal";
import { ProviderList } from "../components/ProviderList";
import type { ProviderSubscription } from "../types";

vi.mock("../api/providersApi");

const LONG_NAME = "StreamingDienstMitSehrLangemNamen".repeat(5);

function provider(overrides: Partial<ProviderSubscription> = {}): ProviderSubscription {
  return {
    id: "prov-1",
    household_id: "hh-1",
    provider_name: "Netflix",
    provider_type: "STREAMING",
    is_active: true,
    created_at: "2025-01-01T00:00:00Z",
    updated_at: "2025-01-01T00:00:00Z",
    ...overrides,
  };
}

describe("ProviderCard", () => {
  it("renders the backend field names and localized type labels", () => {
    const { rerender } = renderWithProviders(
      <ProviderCard provider={provider()} onToggleActive={vi.fn()} onDelete={vi.fn()} />,
      { language: "de" }
    );
    expect(screen.getByRole("heading", { name: "Netflix" })).toBeInTheDocument();
    expect(screen.getByText("Film & Serie")).toBeInTheDocument();

    rerender(
      <ProviderCard provider={provider({ provider_type: "GAMING_PASS" })} onToggleActive={vi.fn()} onDelete={vi.fn()} />
    );
    expect(screen.getByText("Gaming-Abo")).toBeInTheDocument();

    rerender(
      <ProviderCard provider={provider({ provider_type: "BOOK_PASS" })} onToggleActive={vi.fn()} onDelete={vi.fn()} />
    );
    expect(screen.getByText("Buch-Abo")).toBeInTheDocument();

    rerender(
      <ProviderCard provider={provider({ provider_type: "CUSTOM" })} onToggleActive={vi.fn()} onDelete={vi.fn()} />
    );
    expect(screen.getByText("CUSTOM")).toBeInTheDocument();
  });

  it("wraps a very long provider name and keeps the status badge intact", () => {
    renderWithProviders(
      <ProviderCard provider={provider({ provider_name: LONG_NAME })} onToggleActive={vi.fn()} onDelete={vi.fn()} />
    );
    expect(screen.getByRole("heading", { name: LONG_NAME })).toHaveClass("min-w-0", "break-words");
    expect(screen.getByText("Active")).toHaveClass("shrink-0");
  });

  it("toggles and deletes through the callbacks", () => {
    const onToggleActive = vi.fn();
    const onDelete = vi.fn();
    const value = provider();
    renderWithProviders(<ProviderCard provider={value} onToggleActive={onToggleActive} onDelete={onDelete} />);

    fireEvent.click(screen.getByRole("button", { name: "Deactivate" }));
    fireEvent.click(screen.getByRole("button", { name: "Delete" }));
    expect(onToggleActive).toHaveBeenCalledWith("prov-1", true);
    expect(onDelete).toHaveBeenCalledWith(value);
  });
});

describe("ProviderFormModal", () => {
  it("submits the field names and type values the API expects", async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    const onClose = vi.fn();
    renderWithProviders(<ProviderFormModal isOpen onClose={onClose} onSubmit={onSubmit} />);

    fireEvent.change(screen.getByPlaceholderText("e.g. Netflix, PS Plus, Xbox Game Pass"), {
      target: { value: " PS Plus " },
    });
    fireEvent.change(screen.getByRole("combobox"), { target: { value: "GAMING_PASS" } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(onSubmit).toHaveBeenCalledWith({
      provider_name: "PS Plus",
      provider_type: "GAMING_PASS",
      is_active: true,
    });
  });

  it("no longer offers a notes field the API cannot store", () => {
    renderWithProviders(<ProviderFormModal isOpen onClose={vi.fn()} onSubmit={vi.fn()} />);
    expect(screen.queryByText("Notes")).toBeNull();
    expect(screen.queryByRole("option", { name: "Combined" })).toBeNull();
  });

  it("shows a provider-specific, localized save error", async () => {
    const onSubmit = vi.fn().mockRejectedValue(new Error("boom"));
    renderWithProviders(<ProviderFormModal isOpen onClose={vi.fn()} onSubmit={onSubmit} />, { language: "pl" });

    fireEvent.change(screen.getByPlaceholderText("np. Netflix, PS Plus, Xbox Game Pass"), {
      target: { value: "Netflix" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Zapisz" }));

    expect(await screen.findByText("Nie udało się zapisać dostawcy.")).toBeInTheDocument();
  });
});

describe("ProviderList", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  function renderList() {
    return renderWithProviders(<ProviderList />);
  }

  it("lists the providers returned by the API", async () => {
    vi.mocked(providersApi.fetchProviders).mockResolvedValue([provider(), provider({ id: "p2", provider_name: "Disney+" })]);
    renderList();

    expect(await screen.findByRole("heading", { name: "Netflix" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Disney+" })).toBeInTheDocument();
  });

  it("shows the empty and error states", async () => {
    vi.mocked(providersApi.fetchProviders).mockResolvedValueOnce([]);
    const { unmount } = renderList();
    expect(await screen.findByText("No providers configured.")).toBeInTheDocument();
    unmount();

    vi.mocked(providersApi.fetchProviders).mockRejectedValue(new Error("boom"));
    renderList();
    expect(await screen.findByText("Failed to load streaming providers.")).toBeInTheDocument();
  });

  it("explains why a provider that items still use cannot be deleted (issue #558)", async () => {
    vi.mocked(providersApi.fetchProviders).mockResolvedValue([provider()]);
    vi.mocked(providersApi.deleteProvider).mockRejectedValue(
      makeHttpError(409, { detail: { code: "provider_in_use", message: "x", item_count: 2 } })
    );
    renderList();

    fireEvent.click(await screen.findByRole("button", { name: "Delete" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      '"Netflix" is still linked to 2 item(s). Unlink them first.'
    );
    expect(screen.getByRole("heading", { name: "Netflix" })).toBeInTheDocument();
  });

  it("reports other delete failures and failed toggles", async () => {
    vi.mocked(providersApi.fetchProviders).mockResolvedValue([provider()]);
    vi.mocked(providersApi.deleteProvider).mockRejectedValue(new Error("boom"));
    vi.mocked(providersApi.updateProvider).mockRejectedValue(new Error("boom"));
    renderList();

    fireEvent.click(await screen.findByRole("button", { name: "Delete" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Failed to delete the provider.");

    fireEvent.click(screen.getByRole("button", { name: "Deactivate" }));
    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("Failed to update the provider."));
  });

  it("creates a provider through the form", async () => {
    vi.mocked(providersApi.fetchProviders).mockResolvedValue([]);
    vi.mocked(providersApi.createProvider).mockResolvedValue(provider());
    renderList();

    fireEvent.click((await screen.findAllByRole("button", { name: /Add Provider/ }))[0]);
    fireEvent.change(await screen.findByPlaceholderText("e.g. Netflix, PS Plus, Xbox Game Pass"), {
      target: { value: "Netflix" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() =>
      expect(providersApi.createProvider).toHaveBeenCalledWith({
        provider_name: "Netflix",
        provider_type: "STREAMING",
        is_active: true,
      })
    );
  });
});
