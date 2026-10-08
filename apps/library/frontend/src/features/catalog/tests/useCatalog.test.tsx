import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import * as catalogApi from "../api/catalogApi";
import { useCatalog } from "../hooks/useCatalog";
import { createWrapper } from "@/tests/renderWithProviders";
import { makeItem } from "./fixtures";

vi.mock("../api/catalogApi", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../api/catalogApi")>()),
  fetchCatalogItems: vi.fn(),
  fetchLocations: vi.fn(),
}));
vi.mock("@/features/providers", () => ({
  fetchProviders: vi.fn().mockResolvedValue([]),
}));

const page = (ids: string[], skip: number, total: number) => ({
  items: ids.map((id) => makeItem({ id, title: id })),
  total,
  skip,
  limit: catalogApi.CATALOG_PAGE_SIZE,
});

describe("useCatalog pagination", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(catalogApi.fetchLocations).mockResolvedValue([]);
  });

  it("requests the first page and loads further pages on demand (issue #562)", async () => {
    vi.mocked(catalogApi.fetchCatalogItems)
      .mockResolvedValueOnce(page(["a", "b"], 0, 3))
      .mockResolvedValueOnce(page(["c"], 2, 3));

    const { result } = renderHook(() => useCatalog(), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.items.map((i) => i.id)).toEqual(["a", "b"]);
    expect(result.current.total).toBe(3);
    expect(result.current.hasMore).toBe(true);
    expect(catalogApi.fetchCatalogItems).toHaveBeenLastCalledWith(
      expect.objectContaining({ category: "ALL" }),
      0,
      catalogApi.CATALOG_PAGE_SIZE
    );

    await act(async () => {
      await result.current.loadMore();
    });

    expect(catalogApi.fetchCatalogItems).toHaveBeenLastCalledWith(
      expect.objectContaining({ category: "ALL" }),
      2,
      catalogApi.CATALOG_PAGE_SIZE
    );
    await waitFor(() => expect(result.current.items.map((i) => i.id)).toEqual(["a", "b", "c"]));
    expect(result.current.hasMore).toBe(false);
  });

  it("does not offer more when everything fits on one page", async () => {
    vi.mocked(catalogApi.fetchCatalogItems).mockResolvedValue(page(["a"], 0, 1));

    const { result } = renderHook(() => useCatalog(), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.hasMore).toBe(false);
  });

  it("drops items that appear on two pages after the catalog shifted", async () => {
    vi.mocked(catalogApi.fetchCatalogItems)
      .mockResolvedValueOnce(page(["a", "b"], 0, 4))
      .mockResolvedValueOnce(page(["b", "c"], 2, 4));

    const { result } = renderHook(() => useCatalog(), { wrapper: createWrapper() });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    await act(async () => {
      await result.current.loadMore();
    });

    await waitFor(() => expect(result.current.items.map((i) => i.id)).toEqual(["a", "b", "c"]));
  });

  it("starts over from the first page when a filter changes", async () => {
    vi.mocked(catalogApi.fetchCatalogItems).mockResolvedValue(page(["a"], 0, 1));

    const { result } = renderHook(() => useCatalog(), { wrapper: createWrapper() });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    act(() => result.current.setCategory("GAME"));

    await waitFor(() =>
      expect(catalogApi.fetchCatalogItems).toHaveBeenLastCalledWith(
        expect.objectContaining({ category: "GAME" }),
        0,
        catalogApi.CATALOG_PAGE_SIZE
      )
    );
  });

  it("reports a failing next page separately from a failing first page", async () => {
    vi.mocked(catalogApi.fetchCatalogItems)
      .mockResolvedValueOnce(page(["a"], 0, 2))
      .mockRejectedValueOnce(new Error("boom"));

    const { result } = renderHook(() => useCatalog(), { wrapper: createWrapper() });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    await act(async () => {
      await result.current.loadMore();
    });

    await waitFor(() => expect(result.current.isLoadMoreError).toBe(true));
    expect(result.current.isError).toBe(false);
    expect(result.current.items).toHaveLength(1);
  });

  it("reports a failing first page as an error", async () => {
    vi.mocked(catalogApi.fetchCatalogItems).mockRejectedValue(new Error("boom"));

    const { result } = renderHook(() => useCatalog(), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.items).toEqual([]);
  });
});
