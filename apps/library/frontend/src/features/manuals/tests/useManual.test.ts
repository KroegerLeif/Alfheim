import { renderHook, act } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { useManual } from "../hooks/useManual";
import { manualsApi } from "../api/manualsApi";

vi.mock("../api/manualsApi", () => ({
  manualsApi: {
    uploadManual: vi.fn(),
    getManualUrl: vi.fn(),
    deleteManual: vi.fn(),
  },
}));

describe("useManual hook", () => {
  const itemId = "item-123";

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("handles successful PDF manual upload", async () => {
    const onUpdated = vi.fn();
    (manualsApi.uploadManual as any).mockResolvedValue({
      item_id: itemId,
      manual_s3_key: "key/manual.pdf",
      filename: "manual.pdf",
      message: "Uploaded",
    });

    const { result } = renderHook(() => useManual(itemId, onUpdated));

    const dummyFile = new File(["dummy pdf"], "manual.pdf", {
      type: "application/pdf",
    });

    await act(async () => {
      await result.current.uploadManual(dummyFile);
    });

    expect(manualsApi.uploadManual).toHaveBeenCalledWith(itemId, dummyFile);
    expect(onUpdated).toHaveBeenCalled();
    expect(result.current.error).toBeNull();
  });

  it("handles upload error gracefully", async () => {
    (manualsApi.uploadManual as any).mockRejectedValue(
      new Error("Network error")
    );

    const { result } = renderHook(() => useManual(itemId));
    const dummyFile = new File(["dummy pdf"], "manual.pdf", {
      type: "application/pdf",
    });

    await act(async () => {
      await expect(result.current.uploadManual(dummyFile)).rejects.toThrow(
        "Network error"
      );
    });

    expect(result.current.error).toBe("Network error");
  });

  it("fetches presigned download URL", async () => {
    (manualsApi.getManualUrl as any).mockResolvedValue({
      item_id: itemId,
      download_url: "https://s3.example.com/manual.pdf",
      expires_in: 3600,
    });

    const { result } = renderHook(() => useManual(itemId));

    let url: string | null = null;
    await act(async () => {
      url = await result.current.fetchManualUrl();
    });

    expect(manualsApi.getManualUrl).toHaveBeenCalledWith(itemId);
    expect(url).toBe("https://s3.example.com/manual.pdf");
    expect(result.current.downloadUrl).toBe("https://s3.example.com/manual.pdf");
  });

  it("deletes manual and clears download url", async () => {
    const onUpdated = vi.fn();
    (manualsApi.deleteManual as any).mockResolvedValue(undefined);

    const { result } = renderHook(() => useManual(itemId, onUpdated));

    await act(async () => {
      await result.current.deleteManual();
    });

    expect(manualsApi.deleteManual).toHaveBeenCalledWith(itemId);
    expect(onUpdated).toHaveBeenCalled();
    expect(result.current.downloadUrl).toBeNull();
  });
});
