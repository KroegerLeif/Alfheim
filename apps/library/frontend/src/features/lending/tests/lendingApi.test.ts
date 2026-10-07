import { describe, it, expect, vi, beforeEach } from "vitest";
import { libraryClient } from "@/core/api";
import { lendingApi } from "../api/lendingApi";

vi.mock("@/core/api", () => ({ libraryClient: { get: vi.fn(), post: vi.fn() } }));

describe("lendingApi", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(libraryClient.get).mockReturnValue({ json: async () => ({ records: [] }) } as never);
    vi.mocked(libraryClient.post).mockReturnValue({ json: async () => ({ id: "rec-1" }) } as never);
  });

  it("passes the history filters as query parameters", async () => {
    await lendingApi.getLendingHistory({ skip: 10, limit: 5, item_id: "i", contact_name: "Al", status: "LENT_OUT" });

    const [endpoint, options] = vi.mocked(libraryClient.get).mock.calls[0];
    expect(endpoint).toBe("lending/history");
    expect(Object.fromEntries(options?.searchParams as URLSearchParams)).toEqual({
      skip: "10",
      limit: "5",
      item_id: "i",
      contact_name: "Al",
      status: "LENT_OUT",
    });
  });

  it("posts lend and return requests to the item endpoints", async () => {
    await lendingApi.lendItem("item-1", { contact_name: "Alice" });
    await lendingApi.returnItem("item-1");

    expect(libraryClient.post).toHaveBeenNthCalledWith(1, "items/item-1/lend", { json: { contact_name: "Alice" } });
    expect(libraryClient.post).toHaveBeenNthCalledWith(2, "items/item-1/return", { json: {} });
  });
});
