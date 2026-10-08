import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen, fireEvent, waitFor } from "@testing-library/react";
import { makeHttpError, renderWithProviders } from "@/tests/renderWithProviders";
import { makeItem } from "@/features/catalog/tests/fixtures";
import type { ProviderSubscription } from "@/features/providers";
import { ItemDialog } from "../ItemDialog";
import * as dialogApi from "../api/dialogApi";

vi.mock("../api/dialogApi");

const providers: ProviderSubscription[] = [
  {
    id: "prov-1",
    household_id: "hh-1",
    provider_name: "Netflix",
    provider_type: "STREAMING",
    is_active: true,
    created_at: "2025-01-01T00:00:00Z",
    updated_at: "2025-01-01T00:00:00Z",
  },
  {
    id: "prov-2",
    household_id: "hh-1",
    provider_name: "Disney+",
    provider_type: "STREAMING",
    is_active: false,
    created_at: "2025-01-01T00:00:00Z",
    updated_at: "2025-01-01T00:00:00Z",
  },
];

function renderDialog(props: Partial<React.ComponentProps<typeof ItemDialog>> = {}) {
  const onSuccess = vi.fn();
  const onOpenChange = vi.fn();
  renderWithProviders(
    <ItemDialog
      open
      onOpenChange={onOpenChange}
      locations={[{ id: "loc-1", household_id: "hh-1", name: "Shelf" }]}
      providers={providers}
      onSuccess={onSuccess}
      {...props}
    />
  );
  return { onSuccess, onOpenChange };
}

describe("ItemDialog provider link (issue #555)", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("offers the household providers and saves the chosen one with a new item", async () => {
    vi.mocked(dialogApi.createItem).mockResolvedValue(makeItem());
    const { onSuccess, onOpenChange } = renderDialog();

    const select = screen.getByLabelText("Streaming Provider");
    expect(screen.getByRole("option", { name: "-- No Provider --" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Netflix" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Disney+ (inactive)" })).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText(/^Title/), { target: { value: "Stranger Things" } });
    fireEvent.change(screen.getByLabelText(/^Media Type/), { target: { value: "SERIES" } });
    fireEvent.change(select, { target: { value: "prov-1" } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => expect(onSuccess).toHaveBeenCalled());
    expect(dialogApi.createItem).toHaveBeenCalledWith(
      expect.objectContaining({ title: "Stranger Things", media_type: "SERIES", provider_id: "prov-1" })
    );
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("pre-selects the linked provider when editing and can clear it", async () => {
    vi.mocked(dialogApi.updateItem).mockResolvedValue(makeItem());
    const { onSuccess } = renderDialog({
      item: makeItem({ id: "item-9", title: "Stranger Things", media_type: "SERIES", provider_id: "prov-1" }),
    });

    const select = screen.getByLabelText("Streaming Provider") as HTMLSelectElement;
    expect(select.value).toBe("prov-1");

    fireEvent.change(select, { target: { value: "" } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => expect(onSuccess).toHaveBeenCalled());
    expect(dialogApi.updateItem).toHaveBeenCalledWith(
      "item-9",
      expect.objectContaining({ provider_id: null })
    );
  });

  it("shows a localized message when saving fails", async () => {
    vi.mocked(dialogApi.createItem).mockRejectedValue(new Error("boom"));
    renderDialog();

    fireEvent.change(screen.getByLabelText(/^Title/), { target: { value: "Dune" } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Failed to save item. Please check inputs and try again."
    );
  });

  it("limits free text fields to the lengths the API accepts", () => {
    renderDialog();
    expect(screen.getByLabelText(/^Title/)).toHaveAttribute("maxLength", "255");
    expect(screen.getByLabelText("Cover Image URL")).toHaveAttribute("maxLength", "1024");
  });
});

describe("MetadataLookupSection errors (issue #571)", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  async function search(type: "ISBN" | "BGG" | "TMDB", failure: unknown) {
    const lookup = { ISBN: dialogApi.lookupIsbn, BGG: dialogApi.lookupBgg, TMDB: dialogApi.lookupTmdb }[type];
    vi.mocked(lookup).mockRejectedValue(failure);
    renderDialog();
    fireEvent.change(screen.getByRole("combobox", { name: "Lookup source" }), { target: { value: type } });
    fireEvent.change(screen.getByRole("textbox", { name: "Search ISBN, BGG name, or TMDB title..." }), {
      target: { value: "query" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Lookup Metadata" }));
    return screen.findByRole("alert");
  }

  it("tells a missing API key apart from an empty result", async () => {
    const notConfigured = makeHttpError(502, {
      detail: { code: "lookup_not_configured", message: "TMDB API key is not configured on the server." },
    });
    expect(await search("TMDB", notConfigured)).toHaveTextContent("API key missing");
  });

  it("explains an empty result", async () => {
    expect(await search("BGG", makeHttpError(404, { detail: "No board games found" }))).toHaveTextContent(
      "No results found"
    );
  });

  it("explains an invalid query", async () => {
    expect(await search("ISBN", makeHttpError(400, { detail: "Invalid ISBN" }))).toHaveTextContent(
      "The search term is not valid"
    );
  });

  it("explains an unreachable lookup service for 502 and for network failures", async () => {
    expect(await search("TMDB", makeHttpError(502, { detail: "Failed to query TMDB external service." }))).toHaveTextContent(
      "currently unavailable"
    );
  });

  it("falls back to the unavailable message for non-HTTP errors", async () => {
    expect(await search("ISBN", new TypeError("Failed to fetch"))).toHaveTextContent("currently unavailable");
  });
});

describe("MetadataLookupSection results", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("lets the user pick a TMDB result and fills the form with it", async () => {
    vi.mocked(dialogApi.lookupTmdb).mockResolvedValue({
      total: 1,
      results: [
        {
          id: "1",
          title: "Inception",
          media_type: "MOVIE",
          runtime_minutes: 148,
          fsk_rating: 12,
          cover_image_url: null,
        },
      ],
    });
    renderDialog();

    fireEvent.change(screen.getByRole("combobox", { name: "Lookup source" }), { target: { value: "TMDB" } });
    fireEvent.change(screen.getByRole("textbox", { name: "Search ISBN, BGG name, or TMDB title..." }), {
      target: { value: "inception" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Lookup Metadata" }));
    fireEvent.click(await screen.findByRole("button", { name: /Inception/ }));

    expect((screen.getByLabelText(/^Title/) as HTMLInputElement).value).toBe("Inception");
    expect((screen.getByLabelText(/^Media Type/) as HTMLSelectElement).value).toBe("MOVIE");
  });

  it("fills the form straight from an ISBN lookup", async () => {
    vi.mocked(dialogApi.lookupIsbn).mockResolvedValue({
      title: "Dune",
      media_type: "BOOK",
      author_creator: "Frank Herbert",
    });
    renderDialog();

    fireEvent.change(screen.getByRole("textbox", { name: "Search ISBN, BGG name, or TMDB title..." }), {
      target: { value: "9780441172719" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Lookup Metadata" }));

    await waitFor(() => expect((screen.getByLabelText(/^Title/) as HTMLInputElement).value).toBe("Dune"));
    expect((screen.getByLabelText(/^Author/) as HTMLInputElement).value).toBe("Frank Herbert");
  });

  it("lists BGG results with a long title without breaking the layout", async () => {
    const longTitle = "Terraforming Mars Ares Expedition Deluxe Collectors Edition ".repeat(5).trim();
    vi.mocked(dialogApi.lookupBgg).mockResolvedValue({
      total: 1,
      results: [{ id: "7", title: longTitle, media_type: "GAME", min_players: 1, max_players: 5 }],
    });
    renderDialog();

    fireEvent.change(screen.getByRole("combobox", { name: "Lookup source" }), { target: { value: "BGG" } });
    fireEvent.change(screen.getByRole("textbox", { name: "Search ISBN, BGG name, or TMDB title..." }), {
      target: { value: "mars" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Lookup Metadata" }));

    const title = await screen.findByText(longTitle);
    expect(title).toHaveClass("truncate", "min-w-0");
    fireEvent.click(screen.getByRole("button", { name: new RegExp(longTitle.slice(0, 20)) }));
    expect((screen.getByLabelText(/^Title/) as HTMLInputElement).value).toBe(longTitle);
  });
});
