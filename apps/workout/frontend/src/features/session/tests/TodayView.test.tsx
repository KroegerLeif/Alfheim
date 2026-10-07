import { screen, waitFor, fireEvent, within } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { clearQueue, enqueueSet, listPending } from "@/features/offline_sync";
import { closeDbForTests } from "@/features/offline_sync/db";
import { mockSession } from "@/tests/mocks/handlers";
import { server } from "@/tests/mocks/server";
import { routerMock } from "@/tests/mocks/router";
import { renderWithProviders } from "@/tests/test-utils";
import { TodayView } from "../components/TodayView";

function useActiveSessionResponse(overrides: Record<string, unknown> = {}) {
  server.use(
    http.get(/\/sessions$/, () => HttpResponse.json([{ ...mockSession, ...overrides }]))
  );
}

beforeEach(async () => {
  localStorage.clear();
  localStorage.setItem("alfheim_active_household_id", "hh-1");
  await clearQueue();
});

afterEach(async () => {
  await clearQueue();
  await closeDbForTests();
});

describe("TodayView", () => {
  it("offers a free workout when nothing is active and opens the new session", async () => {
    renderWithProviders(<TodayView />);

    fireEvent.click(await screen.findByRole("button", { name: "Start Free Workout" }));

    await waitFor(() => expect(routerMock.push).toHaveBeenCalledWith("/session/sess-1"));
  });

  it("tells the user why a free workout could not be started", async () => {
    server.use(http.post(/\/sessions$/, () => HttpResponse.json({ detail: "Database unavailable" }, { status: 500 })));
    renderWithProviders(<TodayView />);

    fireEvent.click(await screen.findByRole("button", { name: "Start Free Workout" }));

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("Could not start the session");
    expect(alert).toHaveTextContent("Database unavailable");
    expect(routerMock.push).not.toHaveBeenCalled();
  });

  it("shows the active session with resume and abandon", async () => {
    useActiveSessionResponse();
    renderWithProviders(<TodayView />);

    expect(await screen.findByText("Push Day")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Resume" }));

    expect(routerMock.push).toHaveBeenCalledWith("/session/sess-1");
    expect(screen.getByRole("button", { name: "Abandon Session" })).toBeInTheDocument();
  });

  it("abandons a stuck session after confirmation and clears its queued sets", async () => {
    useActiveSessionResponse();
    let abandoned = 0;
    server.use(
      http.post(/\/sessions\/([^/]+)\/sets\/sync$/, () => HttpResponse.error()),
      http.post(/\/sessions\/([^/]+)\/abandon$/, () => {
        abandoned += 1;
        return HttpResponse.json({ ...mockSession, status: "abandoned" });
      })
    );
    await enqueueSet({
      sessionId: "sess-1",
      sessionExerciseId: "sess-ex-1",
      setOrder: 1,
      actualReps: 8,
      actualWeightKg: 60,
    });
    renderWithProviders(<TodayView />);

    await screen.findByText("Push Day");
    fireEvent.click(screen.getByRole("button", { name: "Abandon Session" }));
    const dialog = await screen.findByRole("dialog");
    expect(dialog).toHaveTextContent("Really abandon the session? Logged sets will be kept.");
    expect(abandoned).toBe(0);

    fireEvent.click(within(dialog).getByRole("button", { name: "Abandon Session" }));

    await waitFor(() => expect(abandoned).toBe(1));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(await listPending()).toHaveLength(0);
  });

  it("shows why abandoning failed", async () => {
    useActiveSessionResponse();
    server.use(
      http.post(/\/sessions\/([^/]+)\/abandon$/, () =>
        HttpResponse.json({ detail: "Only an active session can be abandoned." }, { status: 400 })
      )
    );
    renderWithProviders(<TodayView />);

    await screen.findByText("Push Day");
    fireEvent.click(screen.getByRole("button", { name: "Abandon Session" }));
    const dialog = await screen.findByRole("dialog");
    fireEvent.click(within(dialog).getByRole("button", { name: "Abandon Session" }));

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("Could not abandon the session");
    expect(alert).toHaveTextContent("Only an active session can be abandoned.");
  });

  it("shows a load error when the sessions cannot be fetched", async () => {
    server.use(http.get(/\/sessions$/, () => HttpResponse.json({ detail: "boom" }, { status: 500 })));
    renderWithProviders(<TodayView />);

    expect(await screen.findByRole("alert")).toHaveTextContent("Failed to load data");
  });

  it("keeps a very long plan day label inside the card", async () => {
    const longLabel = "Oberkörper-Schwerpunkt".repeat(10);
    useActiveSessionResponse({ plan_day_label: longLabel });
    renderWithProviders(<TodayView />);

    const label = await screen.findByText(longLabel);
    expect(label).toHaveClass("line-clamp-2", "break-words");
    expect(label.parentElement).toHaveClass("min-w-0");
    expect(screen.getByRole("button", { name: "Resume" })).toBeInTheDocument();
  });

  it("renders in Polish", async () => {
    renderWithProviders(<TodayView />, { language: "pl" });

    expect(await screen.findByRole("button", { name: "Rozpocznij Trening Dowolny" })).toBeInTheDocument();
  });
});
