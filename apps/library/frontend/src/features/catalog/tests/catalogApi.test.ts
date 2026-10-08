import { describe, it, expect, vi, beforeEach } from "vitest";
import { libraryClient } from "@/core/api";
import { CATALOG_PAGE_SIZE, fetchCatalogItems } from "../api/catalogApi";

vi.mock("@/core/api", () => ({ libraryClient: { get: vi.fn() } }));

describe("fetchCatalogItems", () => {
  beforeEach(() => {
    vi.mocked(libraryClient.get).mockReset();
    vi.mocked(libraryClient.get).mockReturnValue({
      json: async () => ({ items: [], total: 0, skip: 0, limit: CATALOG_PAGE_SIZE }),
    } as never);
  });

  it("sends the paging parameters together with the filters", async () => {
    await fetchCatalogItems(
      { category: "BOOK", query: "  dune ", isCookbook: true, activeProvidersOnly: true },
      96,
      48
    );

    const endpoint = vi.mocked(libraryClient.get).mock.calls[0][0] as string;
    const params = new URLSearchParams(endpoint.split("?")[1]);
    expect(endpoint.startsWith("search?")).toBe(true);
    expect(Object.fromEntries(params)).toEqual({
      q: "dune",
      media_type: "BOOK",
      is_cookbook: "true",
      active_providers_only: "true",
      skip: "96",
      limit: "48",
    });
  });

  it("defaults to the first page and omits the all-media filter", async () => {
    await fetchCatalogItems({ category: "ALL" });

    const endpoint = vi.mocked(libraryClient.get).mock.calls[0][0] as string;
    expect(Object.fromEntries(new URLSearchParams(endpoint.split("?")[1]))).toEqual({
      skip: "0",
      limit: String(CATALOG_PAGE_SIZE),
    });
  });
});
