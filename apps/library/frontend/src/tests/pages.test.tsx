import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen, fireEvent, waitFor } from "@testing-library/react";
import { renderWithProviders } from "@/tests/renderWithProviders";
import * as catalogApi from "@/features/catalog/api/catalogApi";
import { makeItem } from "@/features/catalog/tests/fixtures";
import * as locationsApi from "@/features/locations/api/locationsApi";
import * as providersApi from "@/features/providers/api/providersApi";
import CatalogPage from "../app/[locale]/catalog/page";
import LocationsPage from "../app/[locale]/locations/page";
import ProvidersPage from "../app/[locale]/providers/page";
import ErrorPage from "../app/[locale]/error";
import Loading from "../app/[locale]/loading";

vi.mock("@/features/catalog/api/catalogApi", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/features/catalog/api/catalogApi")>()),
  fetchCatalogItems: vi.fn(),
  fetchLocations: vi.fn(),
}));
vi.mock("@/features/locations/api/locationsApi");
vi.mock("@/features/providers/api/providersApi");

const items = (ids: string[], skip: number, total: number) => ({
  items: ids.map((id) => makeItem({ id, title: `Book ${id}` })),
  total,
  skip,
  limit: 48,
});

describe("CatalogPage", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(catalogApi.fetchLocations).mockResolvedValue([]);
    vi.mocked(providersApi.fetchProviders).mockResolvedValue([]);
  });

  it("reaches items beyond the first page with the load more button (issue #562)", async () => {
    vi.mocked(catalogApi.fetchCatalogItems)
      .mockResolvedValueOnce(items(["a", "b"], 0, 3))
      .mockResolvedValueOnce(items(["c"], 2, 3));
    renderWithProviders(<CatalogPage />);

    expect(await screen.findByText("Book a")).toBeInTheDocument();
    expect(screen.getByText("Showing 2 of 3")).toBeInTheDocument();
    expect(screen.queryByText("Book c")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Load more" }));

    expect(await screen.findByText("Book c")).toBeInTheDocument();
    expect(screen.getByText("Showing 3 of 3")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Load more" })).toBeNull();
  });

  it("shows the error state without a pager when the first page fails", async () => {
    vi.mocked(catalogApi.fetchCatalogItems).mockRejectedValue(new Error("boom"));
    renderWithProviders(<CatalogPage />);

    expect(await screen.findByText("Failed to load catalog")).toBeInTheDocument();
    expect(screen.queryByText(/Showing/)).toBeNull();
  });

  it("offers the household providers when adding an item", async () => {
    vi.mocked(catalogApi.fetchCatalogItems).mockResolvedValue(items([], 0, 0));
    vi.mocked(providersApi.fetchProviders).mockResolvedValue([
      {
        id: "p1",
        household_id: "hh-1",
        provider_name: "Netflix",
        provider_type: "STREAMING",
        is_active: true,
        created_at: "2025-01-01T00:00:00Z",
        updated_at: "2025-01-01T00:00:00Z",
      },
    ]);
    renderWithProviders(<CatalogPage />);

    await screen.findByText("No media items found.");
    await waitFor(() => expect(providersApi.fetchProviders).toHaveBeenCalled());
    fireEvent.click(screen.getByRole("button", { name: /Add Media Item/ }));

    expect(await screen.findByRole("option", { name: "Netflix" })).toBeInTheDocument();
  });
});

describe("LocationsPage", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("shows a localized message when the locations cannot be loaded", async () => {
    vi.mocked(locationsApi.fetchLocationsTree).mockRejectedValue(new Error("Request failed with status code 500"));
    renderWithProviders(<LocationsPage />, { language: "de" });

    expect(await screen.findByRole("alert")).toHaveTextContent("Lagerorte konnten nicht geladen werden.");
    expect(screen.queryByText(/status code 500/)).toBeNull();
  });
});

describe("ProvidersPage", () => {
  it("renders the provider list", async () => {
    vi.mocked(providersApi.fetchProviders).mockResolvedValue([]);
    renderWithProviders(<ProvidersPage />);
    expect(await screen.findByText("No providers configured.")).toBeInTheDocument();
  });
});

describe("error and loading boundaries", () => {
  it("localizes the error boundary and retries", () => {
    const reset = vi.fn();
    const spy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    renderWithProviders(<ErrorPage error={new Error("boom")} reset={reset} />, { language: "de" });

    expect(screen.getByRole("heading", { name: "Etwas ist schiefgelaufen" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Erneut versuchen" }));
    expect(reset).toHaveBeenCalled();
    spy.mockRestore();
  });

  it("localizes the loading indicator", () => {
    renderWithProviders(<Loading />, { language: "pl" });
    expect(screen.getByText("Ładowanie...")).toBeInTheDocument();
  });
});
