import { http, HttpResponse } from "msw";
import { screen, waitFor } from "@testing-library/react";
import { describe, it, expect, beforeEach } from "vitest";
import { renderWithProviders } from "@/tests/test-utils";
import { server } from "@/tests/mocks/server";
import { AnalyticsView } from "../components/AnalyticsView";

describe("debug view", () => {
  beforeEach(() => {
    localStorage.setItem("alfheim_active_household_id", "hh-1");
  });

  it("shows an alert", async () => {
    server.use(http.get(/\/analytics\/streaks$/, () => HttpResponse.json({}, { status: 500 })));

    renderWithProviders(<AnalyticsView />);

    const start = Date.now();
    await waitFor(() => expect(screen.getByRole("alert")).toBeInTheDocument(), { timeout: 15000 });
    console.log("elapsed ms:", Date.now() - start);
  }, 20000);
});
