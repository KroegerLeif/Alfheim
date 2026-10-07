import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { lendingApi } from "../api/lendingApi";
import { LENDING_HISTORY_LIMIT, useLending } from "../hooks/useLending";
import { makeRecord } from "./fixtures";

vi.mock("../api/lendingApi", () => ({
  lendingApi: {
    getLendingHistory: vi.fn(),
    lendItem: vi.fn(),
    returnItem: vi.fn(),
  },
}));

const returned = makeRecord({ id: "rec-2", item_title: "Emma", status: "AVAILABLE" });
const active = makeRecord();

function mockHistory(all = [active, returned], open = [active], total = all.length) {
  vi.mocked(lendingApi.getLendingHistory).mockImplementation(async (params) => ({
    records: params?.status === "LENT_OUT" ? open : all,
    total: params?.status === "LENT_OUT" ? open.length : total,
    skip: 0,
    limit: LENDING_HISTORY_LIMIT,
  }));
}

describe("useLending", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("loads the history and the open loans separately", async () => {
    mockHistory();
    const { result } = renderHook(() => useLending());

    expect(result.current.isLoading).toBe(true);
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.history).toHaveLength(2);
    expect(result.current.activeLoans).toEqual([active]);
    expect(result.current.error).toBeNull();
    expect(lendingApi.getLendingHistory).toHaveBeenCalledWith({ limit: LENDING_HISTORY_LIMIT });
    expect(lendingApi.getLendingHistory).toHaveBeenCalledWith({ status: "LENT_OUT", limit: LENDING_HISTORY_LIMIT });
  });

  it("keeps an old open loan that fell out of the capped history page", async () => {
    mockHistory([returned], [active], 150);
    const { result } = renderHook(() => useLending());

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.history).toEqual([returned]);
    expect(result.current.total).toBe(150);
    expect(result.current.activeLoans).toEqual([active]);
  });

  it("reports a failed load as a load error", async () => {
    vi.mocked(lendingApi.getLendingHistory).mockRejectedValue(new Error("boom"));
    const { result } = renderHook(() => useLending());

    await waitFor(() => expect(result.current.error).toBe("load"));
    expect(result.current.history).toEqual([]);
  });

  it("returns an item and refreshes the lists", async () => {
    mockHistory();
    vi.mocked(lendingApi.returnItem).mockResolvedValue(returned);
    const { result } = renderHook(() => useLending());
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await act(async () => {
      await result.current.returnItem("item-1");
    });

    expect(lendingApi.returnItem).toHaveBeenCalledWith("item-1", undefined);
    expect(lendingApi.getLendingHistory).toHaveBeenCalledTimes(4);
  });

  it("flags a failed return and rethrows so callers can react", async () => {
    mockHistory();
    vi.mocked(lendingApi.returnItem).mockRejectedValue(new Error("boom"));
    const { result } = renderHook(() => useLending());
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await act(async () => {
      await expect(result.current.returnItem("item-1")).rejects.toThrow("boom");
    });

    expect(result.current.error).toBe("return");
  });

  it("lends an item and flags a failed lend", async () => {
    mockHistory();
    vi.mocked(lendingApi.lendItem).mockResolvedValueOnce(active).mockRejectedValueOnce(new Error("boom"));
    const { result } = renderHook(() => useLending());
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await act(async () => {
      await result.current.lendItem("item-1", { contact_name: "Alice" });
    });
    expect(lendingApi.lendItem).toHaveBeenCalledWith("item-1", { contact_name: "Alice" });
    expect(result.current.error).toBeNull();

    await act(async () => {
      await expect(result.current.lendItem("item-1", { contact_name: "Alice" })).rejects.toThrow("boom");
    });
    expect(result.current.error).toBe("lend");
  });
});
