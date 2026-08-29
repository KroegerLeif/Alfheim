import { http, HttpResponse } from "msw";
import { describe, it, expect, beforeEach } from "vitest";
import { server } from "@/tests/mocks/server";
import { mockLeaderboard, mockMuscleVolume, mockStreaks } from "@/tests/mocks/handlers";
import { analyticsApi } from "../api/analyticsApi";

describe("analyticsApi", () => {
  beforeEach(() => {
    localStorage.setItem("alfheim_active_household_id", "hh-1");
  });

  it("fetches muscle volume matching the MSW fixture", async () => {
    const result = await analyticsApi.getMuscleVolume();

    expect(result).toEqual(mockMuscleVolume);
    expect(result.entries[0]).toHaveProperty("primary_muscle");
    expect(result.entries[0]).toHaveProperty("total_volume_kg");
  });

  it("fetches streaks matching the MSW fixture", async () => {
    const result = await analyticsApi.getStreaks();

    expect(result).toEqual(mockStreaks);
    expect(result).toHaveProperty("current_streak_days");
    expect(result).toHaveProperty("longest_streak_days");
  });

  it("fetches the leaderboard matching the MSW fixture", async () => {
    const result = await analyticsApi.getLeaderboard();

    expect(result).toEqual(mockLeaderboard);
    expect(result.entries[0]).toHaveProperty("user_id");
    expect(result.entries[0]).toHaveProperty("total_volume_kg");
    expect(result.entries[0]).toHaveProperty("completed_session_count");
  });

  it("sends from_date/to_date as query params when provided", async () => {
    let capturedUrl: URL | null = null;
    server.use(
      http.get(/\/analytics\/muscle-volume/, ({ request }) => {
        capturedUrl = new URL(request.url);
        return HttpResponse.json(mockMuscleVolume);
      })
    );

    await analyticsApi.getMuscleVolume({ from_date: "2026-08-01", to_date: "2026-08-27" });

    expect(capturedUrl).not.toBeNull();
    expect(capturedUrl!.searchParams.get("from_date")).toBe("2026-08-01");
    expect(capturedUrl!.searchParams.get("to_date")).toBe("2026-08-27");
  });

  it("omits from_date/to_date from the query string when not provided", async () => {
    let capturedUrl: URL | null = null;
    server.use(
      http.get(/\/analytics\/muscle-volume/, ({ request }) => {
        capturedUrl = new URL(request.url);
        return HttpResponse.json(mockMuscleVolume);
      })
    );

    await analyticsApi.getMuscleVolume();

    expect(capturedUrl).not.toBeNull();
    expect(capturedUrl!.searchParams.has("from_date")).toBe(false);
    expect(capturedUrl!.searchParams.has("to_date")).toBe(false);
  });
});
