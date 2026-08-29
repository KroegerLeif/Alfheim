import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { useLocations } from "../hooks/useLocations";
import * as locationsApi from "../api/locationsApi";

vi.mock("../api/locationsApi");

const mockLocationsTree = [
  {
    id: "loc-1",
    household_id: "hh-1",
    name: "Living Room",
    description: "Main room",
    parent_id: null,
    created_at: "2025-01-01T00:00:00Z",
    updated_at: "2025-01-01T00:00:00Z",
    children: [
      {
        id: "loc-2",
        household_id: "hh-1",
        name: "Bookshelf",
        description: "Wood shelf",
        parent_id: "loc-1",
        created_at: "2025-01-01T00:00:00Z",
        updated_at: "2025-01-01T00:00:00Z",
        children: [],
      },
    ],
  },
];

describe("useLocations hook", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("fetches locations tree on mount", async () => {
    vi.mocked(locationsApi.fetchLocationsTree).mockResolvedValue(mockLocationsTree as any);

    const { result } = renderHook(() => useLocations());

    expect(result.current.isLoading).toBe(true);

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.locations).toEqual(mockLocationsTree);
    expect(result.current.error).toBeNull();
  });

  it("handles location creation", async () => {
    vi.mocked(locationsApi.fetchLocationsTree).mockResolvedValue(mockLocationsTree as any);
    vi.mocked(locationsApi.createLocation).mockResolvedValue({} as any);

    const { result } = renderHook(() => useLocations());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    await act(async () => {
      await result.current.handleCreate({ name: "Bedroom", parent_id: null });
    });

    expect(locationsApi.createLocation).toHaveBeenCalledWith({
      name: "Bedroom",
      parent_id: null,
    });
    expect(locationsApi.fetchLocationsTree).toHaveBeenCalledTimes(2);
  });

  it("handles location deletion", async () => {
    vi.mocked(locationsApi.fetchLocationsTree).mockResolvedValue(mockLocationsTree as any);
    vi.mocked(locationsApi.deleteLocation).mockResolvedValue();

    const { result } = renderHook(() => useLocations());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    await act(async () => {
      await result.current.handleDelete("loc-1");
    });

    expect(locationsApi.deleteLocation).toHaveBeenCalledWith("loc-1");
    expect(locationsApi.fetchLocationsTree).toHaveBeenCalledTimes(2);
  });
});
