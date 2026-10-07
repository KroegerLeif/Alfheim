import { describe, it, expect, vi, beforeEach } from "vitest";
import { libraryClient } from "@/core/api";
import { createItem, lookupBgg, lookupIsbn, lookupTmdb, updateItem } from "@/features/item-dialog/api/dialogApi";
import {
  createLocation,
  deleteLocation,
  fetchLocationsFlat,
  fetchLocationsTree,
  updateLocation,
} from "@/features/locations/api/locationsApi";
import { manualsApi } from "@/features/manuals/api/manualsApi";
import {
  createProvider,
  deleteProvider,
  fetchProviders,
  updateProvider,
} from "@/features/providers/api/providersApi";

vi.mock("@/core/api", () => ({
  libraryClient: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() },
}));

const respond = (body: unknown = {}) => ({ json: async () => body });

describe("library API clients", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(libraryClient.get).mockReturnValue(respond([]) as never);
    vi.mocked(libraryClient.post).mockReturnValue(respond() as never);
    vi.mocked(libraryClient.put).mockReturnValue(respond() as never);
    vi.mocked(libraryClient.delete).mockResolvedValue(undefined as never);
  });

  it("item dialog: looks up metadata and saves items", async () => {
    await lookupIsbn("9780441172719");
    await lookupBgg("catan");
    await lookupTmdb("alien");
    await createItem({ title: "Dune", media_type: "BOOK", is_cookbook: false, provider_id: "p1" });
    await updateItem("i1", { provider_id: null });

    expect(libraryClient.get).toHaveBeenNthCalledWith(1, "lookup/isbn", { searchParams: { isbn: "9780441172719" } });
    expect(libraryClient.get).toHaveBeenNthCalledWith(2, "lookup/bgg", { searchParams: { query: "catan" } });
    expect(libraryClient.get).toHaveBeenNthCalledWith(3, "lookup/tmdb", { searchParams: { query: "alien" } });
    expect(libraryClient.post).toHaveBeenCalledWith("items", {
      json: { title: "Dune", media_type: "BOOK", is_cookbook: false, provider_id: "p1" },
    });
    expect(libraryClient.put).toHaveBeenCalledWith("items/i1", { json: { provider_id: null } });
  });

  it("locations: reads the tree and writes locations", async () => {
    await fetchLocationsTree();
    await fetchLocationsFlat();
    await createLocation({ name: "Shelf" });
    await updateLocation("l1", { name: "Rack" });
    await deleteLocation("l1");

    expect(libraryClient.get).toHaveBeenNthCalledWith(1, "locations", { searchParams: { tree: true } });
    expect(libraryClient.get).toHaveBeenNthCalledWith(2, "locations");
    expect(libraryClient.post).toHaveBeenCalledWith("locations", { json: { name: "Shelf" } });
    expect(libraryClient.put).toHaveBeenCalledWith("locations/l1", { json: { name: "Rack" } });
    expect(libraryClient.delete).toHaveBeenCalledWith("locations/l1");
  });

  it("providers: filters by activity and sends backend field names", async () => {
    await fetchProviders();
    await fetchProviders(true);
    await createProvider({ provider_name: "Netflix", provider_type: "STREAMING" });
    await updateProvider("p1", { is_active: false });
    await deleteProvider("p1");

    expect(libraryClient.get).toHaveBeenNthCalledWith(1, "providers");
    expect(libraryClient.get).toHaveBeenNthCalledWith(2, "providers?is_active=true");
    expect(libraryClient.post).toHaveBeenCalledWith("providers", {
      json: { provider_name: "Netflix", provider_type: "STREAMING" },
    });
    expect(libraryClient.put).toHaveBeenCalledWith("providers/p1", { json: { is_active: false } });
    expect(libraryClient.delete).toHaveBeenCalledWith("providers/p1");
  });

  it("manuals: uploads a PDF, fetches the URL and deletes", async () => {
    const file = new File(["x"], "manual.pdf", { type: "application/pdf" });
    await manualsApi.uploadManual("i1", file);
    await manualsApi.getManualUrl("i1");
    await manualsApi.deleteManual("i1");

    const [endpoint, options] = vi.mocked(libraryClient.post).mock.calls[0];
    expect(endpoint).toBe("items/i1/manual");
    expect((options?.body as FormData).get("file")).toBe(file);
    expect(libraryClient.get).toHaveBeenCalledWith("items/i1/manual/url");
    expect(libraryClient.delete).toHaveBeenCalledWith("items/i1/manual");
  });
});
