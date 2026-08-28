import { http, HttpResponse } from "msw";
import { renderHook, screen, waitFor } from "@testing-library/react";
import { describe, it, expect, beforeEach } from "vitest";
import { axe } from "vitest-axe";
import { createQueryWrapper, renderWithProviders } from "@/tests/test-utils";
import { server } from "@/tests/mocks/server";
import { mockLeaderboard, mockMuscleVolume, mockStreaks } from "@/tests/mocks/handlers";
import { AnalyticsView } from "../components/AnalyticsView";
import { useStreaks } from "../hooks/useAnalytics";

describe("AnalyticsView", () => {
  beforeEach(() => {
    localStorage.setItem("alfheim_active_household_id", "hh-1");
  });

  it("renders the page heading", async () => {
    renderWithProviders(<AnalyticsView />);

    expect(screen.getByText("analyticsTitle")).toBeInTheDocument();
    expect(screen.getByText("analyticsSubtitle")).toBeInTheDocument();

    await waitFor(() => expect(screen.queryByRole("status")).not.toBeInTheDocument());
  });

  it("renders streak, muscle volume, and leaderboard data once loaded", async () => {
    renderWithProviders(<AnalyticsView />);

    await waitFor(() => expect(screen.queryByRole("status")).not.toBeInTheDocument());

    // StreakPanel: both stat cards render, mocked t() drops the {count} param.
    expect(screen.getByText("currentStreak")).toBeInTheDocument();
    expect(screen.getByText("longestStreak")).toBeInTheDocument();
    expect(screen.getAllByText("streakDays")).toHaveLength(2);

    // MuscleVolumePanel: bars are summarized as a single accessible image.
    const chart = screen.getByRole("img", { name: /1200/ });
    expect(chart).toBeInTheDocument();

    // LeaderboardPanel: fixture row renders with the truncated user id.
    expect(screen.getByText(mockLeaderboard.entries[0].user_id)).toBeInTheDocument();
    expect(
      screen.getByText(String(mockLeaderboard.entries[0].completed_session_count))
    ).toBeInTheDocument();
  });

  it("shows an alert when any analytics request fails", async () => {
    server.use(http.get(/\/analytics\/streaks$/, () => HttpResponse.json({}, { status: 500 })));

    renderWithProviders(<AnalyticsView />);

    // ky retries GET 500s a couple of times with backoff before the query
    // client settles into an error state, so this needs more than the
    // default 1000ms waitFor budget.
    await waitFor(() => expect(screen.getByRole("alert")).toBeInTheDocument(), { timeout: 5000 });
    expect(screen.getByRole("alert")).toHaveTextContent("loadFailed");
  }, 10000);

  it("shows the empty state when there is no volume data and no leaderboard entries", async () => {
    server.use(
      http.get(/\/analytics\/muscle-volume$/, () =>
        HttpResponse.json({ ...mockMuscleVolume, entries: [] })
      ),
      http.get(/\/analytics\/leaderboard$/, () => HttpResponse.json({ entries: [] }))
    );

    renderWithProviders(<AnalyticsView />);

    await waitFor(() => expect(screen.getByText("noAnalyticsData")).toBeInTheDocument());
    expect(screen.getByText("noAnalyticsDataSubtitle")).toBeInTheDocument();
  });

  it("passes accessibility audit once loaded", async () => {
    const { container } = renderWithProviders(<AnalyticsView />);

    await waitFor(() => expect(screen.queryByRole("status")).not.toBeInTheDocument());

    expect(await axe(container)).toHaveNoViolations();
  });

  it("guards streak values with a fallback when the response has zero streaks", async () => {
    server.use(
      http.get(/\/analytics\/streaks$/, () =>
        HttpResponse.json({ current_streak_days: 0, longest_streak_days: 0 })
      )
    );

    renderWithProviders(<AnalyticsView />);

    await waitFor(() => expect(screen.queryByRole("status")).not.toBeInTheDocument());
    expect(screen.getAllByText("streakDays")).toHaveLength(2);
  });

  it("wires useStreaks to the exact fixture values, independent of the mocked translator", async () => {
    const { result } = renderHook(() => useStreaks(), { wrapper: createQueryWrapper() });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data).toEqual(mockStreaks);
    expect(result.current.data?.current_streak_days).toBe(3);
    expect(result.current.data?.longest_streak_days).toBe(7);
  });
});
