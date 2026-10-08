import { screen, waitFor, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { describe, it, expect, beforeEach, vi } from "vitest";
import { mockEquipment } from "@/tests/mocks/handlers";
import { server } from "@/tests/mocks/server";
import { renderWithI18n, renderWithProviders } from "@/tests/test-utils";
import { EquipmentCard } from "../components/EquipmentCard";
import { EquipmentCreateForm } from "../components/EquipmentCreateForm";
import { EquipmentListView } from "../components/EquipmentListView";
import type { EquipmentRead } from "../types";

const dumbbells = mockEquipment[0] as EquipmentRead;
const barbell = mockEquipment[1] as EquipmentRead;

beforeEach(() => {
  localStorage.clear();
  localStorage.setItem("alfheim_active_household_id", "hh-1");
});

describe("EquipmentListView", () => {
  it("lists equipment and hides delete for system entries", async () => {
    renderWithProviders(<EquipmentListView />);

    expect(await screen.findByText("Adjustable Dumbbells")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Delete Adjustable Dumbbells" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Delete Barbell" })).not.toBeInTheDocument();
  });

  it("explains why deleting failed", async () => {
    server.use(http.delete(/\/equipment\/([^/]+)$/, () => HttpResponse.json({ detail: "Equipment is in use" }, { status: 409 })));
    const user = userEvent.setup();
    renderWithProviders(<EquipmentListView />);

    await user.click(await screen.findByRole("button", { name: "Delete Adjustable Dumbbells" }));

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("Could not delete the entry");
    expect(alert).toHaveTextContent("Equipment is in use");
  });

  it("shows the empty state and the load error", async () => {
    server.use(http.get(/\/equipment$/, () => HttpResponse.json({ detail: "boom" }, { status: 500 })));
    renderWithProviders(<EquipmentListView />);

    expect(await screen.findByRole("alert")).toHaveTextContent("Failed to load data");
    expect(await screen.findByText("No equipment found")).toBeInTheDocument();
  });

  it("opens and closes the create form", async () => {
    const user = userEvent.setup();
    renderWithProviders(<EquipmentListView />);

    await screen.findByText("Adjustable Dumbbells");
    await user.click(screen.getByRole("button", { name: "Create Equipment" }));
    expect(screen.getByLabelText(/^Name/)).toBeInTheDocument();

    const cancelButtons = screen.getAllByRole("button", { name: "Cancel" });
    await user.click(cancelButtons[cancelButtons.length - 1]);
    expect(screen.queryByLabelText(/^Name/)).not.toBeInTheDocument();
  });
});

describe("EquipmentCard", () => {
  it("keeps very long names and categories inside the card", () => {
    const longName = "Kabelzug-Station".repeat(12);
    const longCategory = "Widerstandstraining".repeat(10);
    renderWithI18n(
      <EquipmentCard equipment={{ ...dumbbells, name: longName, category: longCategory }} onDelete={vi.fn()} />
    );

    const title = screen.getByRole("heading", { name: longName });
    expect(title).toHaveClass("break-words", "line-clamp-2");
    expect(title.parentElement).toHaveClass("min-w-0");
    expect(screen.getByText(longCategory)).toHaveClass("break-words");
    expect(screen.getByRole("button", { name: `Delete ${longName}` })).toHaveClass("shrink-0");
  });

  it("shows the scope label in the active language", () => {
    renderWithI18n(<EquipmentCard equipment={barbell} onDelete={vi.fn()} />, "de");
    expect(screen.getByText("System")).toBeInTheDocument();
  });
});

describe("EquipmentCreateForm", () => {
  it("requires a name", async () => {
    renderWithProviders(<EquipmentCreateForm onSuccess={vi.fn()} onCancel={vi.fn()} />);

    fireEvent.submit(screen.getByRole("button", { name: "Create" }).closest("form") as HTMLFormElement);

    expect(await screen.findByRole("alert")).toHaveTextContent("Name is required");
  });

  it("creates the entry", async () => {
    const onSuccess = vi.fn();
    const user = userEvent.setup();
    renderWithProviders(<EquipmentCreateForm onSuccess={onSuccess} onCancel={vi.fn()} />);

    await user.type(screen.getByLabelText(/^Name/), "Kettlebell");
    await user.type(screen.getByLabelText("Category"), "free_weights");
    await user.click(screen.getByRole("button", { name: "Create" }));

    await waitFor(() => expect(onSuccess).toHaveBeenCalled());
  });

  it("shows why creating failed", async () => {
    server.use(http.post(/\/equipment$/, () => HttpResponse.json({ detail: "Duplicate name" }, { status: 400 })));
    const user = userEvent.setup();
    renderWithProviders(<EquipmentCreateForm onSuccess={vi.fn()} onCancel={vi.fn()} />);

    await user.type(screen.getByLabelText(/^Name/), "Kettlebell");
    await user.click(screen.getByRole("button", { name: "Create" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Save failed: Duplicate name");
  });
});
