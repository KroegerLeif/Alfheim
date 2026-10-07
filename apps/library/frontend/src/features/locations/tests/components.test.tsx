import { describe, it, expect, vi } from "vitest";
import { screen, fireEvent, waitFor } from "@testing-library/react";
import { makeHttpError, renderWithProviders } from "@/tests/renderWithProviders";
import { LocationDeleteModal } from "../components/LocationDeleteModal";
import { LocationFormModal } from "../components/LocationFormModal";
import { LocationTreeNodeItem } from "../components/LocationTreeNodeItem";
import { LocationTreeView } from "../components/LocationTreeView";
import type { LocationNode } from "../types";

const LONG_NAME = "Wohnzimmerregalbodenkistenunterteilung".repeat(5);

function node(overrides: Partial<LocationNode> = {}): LocationNode {
  return {
    id: "loc-1",
    household_id: "hh-1",
    name: "Living Room",
    description: null,
    parent_id: null,
    created_at: "2025-01-01T00:00:00Z",
    updated_at: "2025-01-01T00:00:00Z",
    children: [],
    ...overrides,
  };
}

const tree: LocationNode[] = [
  node({
    id: "room",
    name: "Room",
    children: [
      node({
        id: "shelf",
        name: "Shelf",
        parent_id: "room",
        children: [node({ id: "box", name: "Box", parent_id: "shelf" })],
      }),
    ],
  }),
  node({ id: "garage", name: "Garage" }),
];

describe("LocationDeleteModal (issue #558)", () => {
  it("explains that items must be moved first when the API answers 409 location_in_use", async () => {
    const onConfirm = vi.fn().mockRejectedValue(
      makeHttpError(409, { detail: { code: "location_in_use", message: "x", item_count: 4 } })
    );
    const onClose = vi.fn();
    renderWithProviders(
      <LocationDeleteModal isOpen onClose={onClose} locationToDelete={node()} onConfirm={onConfirm} />
    );

    fireEvent.click(screen.getByRole("button", { name: "Delete" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      'Location "Living Room" still holds 4 item(s). Move or delete them first.'
    );
    expect(onClose).not.toHaveBeenCalled();
  });

  it("falls back to the generic delete error for other failures", async () => {
    const onConfirm = vi.fn().mockRejectedValue(new Error("HTTP 500"));
    renderWithProviders(
      <LocationDeleteModal isOpen onClose={vi.fn()} locationToDelete={node()} onConfirm={onConfirm} />,
      { language: "pl" }
    );

    fireEvent.click(screen.getByRole("button", { name: "Usuń" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Nie udało się usunąć lokalizacji.");
  });

  it("closes after a successful delete and warns about sub-locations", async () => {
    const onConfirm = vi.fn().mockResolvedValue(undefined);
    const onClose = vi.fn();
    renderWithProviders(
      <LocationDeleteModal
        isOpen
        onClose={onClose}
        locationToDelete={node({ children: [node({ id: "c" })] })}
        onConfirm={onConfirm}
      />
    );

    expect(screen.getByText("Its sub-locations will be deleted as well.")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Delete" }));

    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(onConfirm).toHaveBeenCalledWith("loc-1");
  });

  it("wraps a very long location name in the confirmation", () => {
    renderWithProviders(
      <LocationDeleteModal isOpen onClose={vi.fn()} locationToDelete={node({ name: LONG_NAME })} onConfirm={vi.fn()} />
    );
    expect(screen.getByText(new RegExp(LONG_NAME))).toHaveClass("break-words");
  });
});

describe("LocationFormModal", () => {
  it("does not offer the edited location or its descendants as parent", () => {
    renderWithProviders(
      <LocationFormModal
        isOpen
        onClose={vi.fn()}
        locationToEdit={tree[0]}
        defaultParentId={null}
        allLocations={tree}
        onSave={vi.fn()}
      />
    );

    const options = screen.getAllByRole("option").map((o) => o.textContent);
    expect(options).toEqual(["-- No Location --", "Garage"]);
  });

  it("offers every location with its path when creating", () => {
    renderWithProviders(
      <LocationFormModal isOpen onClose={vi.fn()} locationToEdit={null} defaultParentId={null} allLocations={tree} onSave={vi.fn()} />
    );
    expect(screen.getAllByRole("option").map((o) => o.textContent)).toEqual([
      "-- No Location --",
      "Room",
      "Room / Shelf",
      "Room / Shelf / Box",
      "Garage",
    ]);
  });

  it("saves a trimmed payload with the chosen parent", async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    const onClose = vi.fn();
    renderWithProviders(
      <LocationFormModal isOpen onClose={onClose} locationToEdit={null} defaultParentId="garage" allLocations={tree} onSave={onSave} />
    );

    fireEvent.change(screen.getByLabelText(/^Location Name/), { target: { value: "  Workbench " } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(onSave).toHaveBeenCalledWith({ name: "Workbench", description: null, parent_id: "garage" });
  });

  it("shows the localized save error, not the exception text", async () => {
    const onSave = vi.fn().mockRejectedValue(new Error("Request failed with status code 400"));
    renderWithProviders(
      <LocationFormModal isOpen onClose={vi.fn()} locationToEdit={null} defaultParentId={null} allLocations={tree} onSave={onSave} />,
      { language: "de" }
    );

    fireEvent.change(screen.getByLabelText(/^Name des Lagerorts/), { target: { value: "Keller" } });
    fireEvent.click(screen.getByRole("button", { name: "Speichern" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Fehler beim Speichern des Lagerorts.");
  });
});

describe("LocationTreeNodeItem", () => {
  const handlers = { onAddChild: vi.fn(), onEdit: vi.fn(), onDelete: vi.fn() };

  it("gives the icon-only buttons accessible names and wires them up", () => {
    const target = node({ name: "Attic" });
    renderWithProviders(<LocationTreeNodeItem node={target} {...handlers} />);

    fireEvent.click(screen.getByRole("button", { name: "Edit location Attic" }));
    fireEvent.click(screen.getByRole("button", { name: "Delete location Attic" }));
    fireEvent.click(screen.getByRole("button", { name: "Add Location" }));
    expect(handlers.onEdit).toHaveBeenCalledWith(target);
    expect(handlers.onDelete).toHaveBeenCalledWith(target);
    expect(handlers.onAddChild).toHaveBeenCalledWith("loc-1");
  });

  it("collapses and expands the children with a localized, named toggle", () => {
    renderWithProviders(<LocationTreeNodeItem node={tree[0]} {...handlers} />);

    expect(screen.getByText("Shelf")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Collapse Room" }));
    expect(screen.queryByText("Shelf")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Expand Room" }));
    expect(screen.getByText("Shelf")).toBeInTheDocument();
  });

  it("truncates a very long name and description and keeps the actions visible", () => {
    renderWithProviders(
      <LocationTreeNodeItem node={node({ name: LONG_NAME, description: LONG_NAME, itemCount: 3 })} {...handlers} />
    );

    const [name, description] = screen.getAllByText(LONG_NAME);
    expect(name).toHaveClass("truncate", "min-w-0");
    expect(description).toHaveClass("truncate");
    expect(screen.getByRole("button", { name: `Edit location ${LONG_NAME}` }).parentElement).toHaveClass("shrink-0");
    expect(screen.getByText("3 items")).toBeInTheDocument();
  });
});

describe("LocationTreeView", () => {
  const props = {
    isLoading: false,
    onAddRootLocation: vi.fn(),
    onAddChildLocation: vi.fn(),
    onEditLocation: vi.fn(),
    onDeleteLocation: vi.fn(),
  };

  it("shows the empty state with a create action", () => {
    renderWithProviders(<LocationTreeView {...props} locations={[]} />);
    expect(screen.getByText("No locations created.")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Add Location/ }));
    expect(props.onAddRootLocation).toHaveBeenCalled();
  });

  it("renders the loading skeleton", () => {
    const { container } = renderWithProviders(<LocationTreeView {...props} locations={[]} isLoading />);
    expect(container.querySelectorAll(".animate-pulse")).toHaveLength(4);
  });

  it("renders the root locations", () => {
    renderWithProviders(<LocationTreeView {...props} locations={tree} />);
    expect(screen.getByText("Garage")).toBeInTheDocument();
    expect(screen.getByText("Room")).toBeInTheDocument();
  });
});
