import { screen, waitFor, fireEvent, within } from "@testing-library/react";
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { axe } from "vitest-axe";
import { clearQueue, enqueueSet, listPending, MAX_SYNC_ATTEMPTS } from "@/features/offline_sync";
import { closeDbForTests } from "@/features/offline_sync/db";
import { routerMock } from "@/tests/mocks/router";
import { renderWithProviders } from "@/tests/test-utils";
import { BerserkerView } from "../components/BerserkerView";
import { installSessionServer, makeExercise, makeSession, makeSet } from "./fixtures";

const logSet = () => screen.getByRole("button", { name: "Log Set" });

async function renderHud(session = makeSession()) {
  const serverState = installSessionServer(session);
  renderWithProviders(<BerserkerView sessionId={session.id} />);
  await screen.findByRole("heading", { level: 1, name: session.plan_day_label ?? "Active Session" });
  return serverState;
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

describe("BerserkerView HUD", () => {
  it("shows the next open set with the backend-resolved targets pre-filled", async () => {
    await renderHud();

    expect(screen.getByRole("heading", { level: 2, name: "Bench Press" })).toBeInTheDocument();
    expect(screen.getByText("Set 1")).toBeInTheDocument();
    expect(screen.getByLabelText("Reps")).toHaveValue(8);
    expect(screen.getByLabelText("Weight")).toHaveValue(60);
    expect(screen.getByRole("status")).toHaveTextContent("Synced");
    // Overview: both exercises, none done yet.
    const overview = screen.getByRole("list");
    expect(within(overview).getByText("Bench Press")).toBeInTheDocument();
    expect(within(overview).getByText("Squat")).toBeInTheDocument();
    expect(within(overview).getByText("0/2")).toBeInTheDocument();
  });

  it("passes the accessibility audit", async () => {
    installSessionServer();
    const { container } = renderWithProviders(<BerserkerView sessionId="sess-1" />);
    await screen.findByRole("button", { name: "Log Set" });

    expect(await axe(container)).toHaveNoViolations();
  });

  it("logs the edited values through the queue, advances, and starts the rest timer", async () => {
    const server = await renderHud();

    fireEvent.click(screen.getByRole("button", { name: "Reps +1" }));
    fireEvent.click(screen.getByRole("button", { name: "Weight +2.5" }));
    fireEvent.click(logSet());

    // Advances to set 2 right away, without waiting for the network.
    await screen.findByText("Set 2");
    expect(screen.getByLabelText("Weight")).toHaveValue(65);
    expect(await screen.findByRole("timer")).toHaveTextContent(/^Rest\s*1:(30|29)/);

    await waitFor(() => expect(server.syncBatches).toHaveLength(1));
    expect(server.syncBatches[0]).toHaveLength(1);
    expect(server.syncBatches[0][0]).toMatchObject({
      session_exercise_id: "ex-bench",
      set_order: 1,
      actual_reps: 9,
      actual_weight_kg: 62.5,
      is_warmup: false,
    });
    expect(server.syncBatches[0][0].client_idempotency_key).toBeTruthy();
    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("Synced"));
    expect(await listPending()).toHaveLength(0);
  });

  it("moves on to the next exercise and finally offers a finished session", async () => {
    const server = await renderHud();

    fireEvent.click(logSet());
    await screen.findByText("Set 2");
    fireEvent.click(logSet());

    expect(await screen.findByRole("heading", { level: 2, name: "Squat" })).toBeInTheDocument();
    expect(screen.getByText("No default weight set")).toBeInTheDocument();
    fireEvent.click(logSet());

    expect(await screen.findByText("Session Complete")).toBeInTheDocument();
    await waitFor(() => expect(server.session.exercises.every((e) => e.sets.every((s) => s.completed_at))).toBe(true));
  });

  it("keeps a set logged while the server is unreachable and delivers it after a retry", async () => {
    const server = await renderHud();
    server.syncMode = "network";

    fireEvent.click(logSet());

    await screen.findByText("Set 2");
    expect(await screen.findByText("Sync Failed")).toBeInTheDocument();
    expect(await listPending()).toHaveLength(1);

    server.syncMode = "ok";
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));

    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("Synced"));
    expect(await listPending()).toHaveLength(0);
    // The retry reused the stored idempotency key rather than creating a second set.
    expect(server.syncBatches[0][0].client_idempotency_key).toBe(server.syncBatches[1][0].client_idempotency_key);
  });

  it("tells the user when a set is discarded after repeated failures and offers it again", async () => {
    const server = await renderHud();
    server.syncMode = "network";

    fireEvent.click(logSet());
    await screen.findByText("Set 2");
    await screen.findByText("Sync Failed");

    for (let attempt = 1; attempt < MAX_SYNC_ATTEMPTS; attempt += 1) {
      await waitFor(() => expect(screen.getByRole("button", { name: "Retry" })).toBeEnabled());
      fireEvent.click(screen.getByRole("button", { name: "Retry" }));
      await waitFor(() => expect(server.syncBatches).toHaveLength(attempt + 1));
    }

    const alert = await screen.findByText(/Sets that could not be saved and were discarded: 1/);
    expect(alert).toBeInTheDocument();
    expect(await listPending()).toHaveLength(0);
    // The set that never reached the server is the active one again.
    await waitFor(() => expect(screen.getByText("Set 1")).toBeInTheDocument());

    fireEvent.click(screen.getByRole("button", { name: "Dismiss" }));
    expect(screen.queryByText(/could not be saved and were discarded/)).not.toBeInTheDocument();
  });

  it("hands the set back at once when the session was already finalized elsewhere", async () => {
    const server = await renderHud();
    server.syncMode = "inactive";

    fireEvent.click(logSet());

    expect(await screen.findByText(/Sets that could not be saved and were discarded: 1/)).toBeInTheDocument();
    expect(server.syncBatches).toHaveLength(1);
    expect(await listPending()).toHaveLength(0);
    await waitFor(() => expect(screen.getByText("Set 1")).toBeInTheDocument());
  });

  it("does not offer a set again that is still waiting in the queue after a reload", async () => {
    await enqueueSet({
      sessionId: "sess-1",
      sessionExerciseId: "ex-bench",
      setOrder: 1,
      actualReps: 8,
      actualWeightKg: 60,
      clientIdempotencyKey: "left-over",
    });
    const server = installSessionServer();
    server.syncMode = "network";

    renderWithProviders(<BerserkerView sessionId="sess-1" />);

    await screen.findByText("Set 2");
    expect(screen.queryByText("Set 1")).not.toBeInTheDocument();
  });

  it("shows an error when the set cannot be stored on the device", async () => {
    await renderHud();
    indexedDB.deleteDatabase("alfheim-workout");
    const original = indexedDB.open.bind(indexedDB);
    indexedDB.open = (() => {
      throw new Error("storage blocked");
    }) as typeof indexedDB.open;
    await closeDbForTests();

    try {
      fireEvent.click(logSet());
      expect(await screen.findByText("Could not save this set on the device")).toBeInTheDocument();
      expect(screen.getByText("Set 1")).toBeInTheDocument();
    } finally {
      indexedDB.open = original;
    }
  });

  it("shows a load error for a session that cannot be fetched", async () => {
    installSessionServer();
    const { http, HttpResponse } = await import("msw");
    const { server } = await import("@/tests/mocks/server");
    server.use(http.get(/\/sessions\/([^/]+)$/, () => HttpResponse.json({ detail: "nope" }, { status: 404 })));

    renderWithProviders(<BerserkerView sessionId="missing" />);

    expect(await screen.findByRole("alert")).toHaveTextContent("Failed to load data");
  });

  it("explains an empty session and still allows finishing it", async () => {
    await renderHud(makeSession({ exercises: [] }));

    expect(screen.getByText("No Active Session")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Finish Session" })).toBeEnabled();
  });

  it("wraps very long exercise names and plan day labels", async () => {
    const longName = "Langhantel-Schrägbankdrücken".repeat(8);
    const longLabel = "Oberkörper-Tag".repeat(12);
    await renderHud(
      makeSession({
        plan_day_label: longLabel,
        exercises: [makeExercise("ex-long", longName, [makeSet({ id: "s", set_order: 1 })])],
      })
    );

    expect(screen.getByRole("heading", { level: 1, name: longLabel })).toHaveClass("break-words", "line-clamp-2");
    expect(screen.getByRole("heading", { level: 2, name: longName })).toHaveClass("break-words", "line-clamp-2");
    expect(screen.getAllByText(longName).some((node) => node.classList.contains("truncate"))).toBe(true);
  });
});

describe("BerserkerView finishing and abandoning", () => {
  it("completes the session after the queue was drained and returns to Today", async () => {
    const server = await renderHud();
    fireEvent.click(logSet());
    await screen.findByText("Set 2");

    fireEvent.click(screen.getByRole("button", { name: "Finish Session" }));

    await waitFor(() => expect(routerMock.push).toHaveBeenCalledWith("/"));
    expect(server.completeCalls).toBe(1);
    expect(server.syncBatches.length).toBeGreaterThan(0);
  });

  it("refuses to finish while logged sets have not reached the server", async () => {
    const server = await renderHud();
    server.syncMode = "network";
    fireEvent.click(logSet());
    await screen.findByText("Sync Failed");

    fireEvent.click(screen.getByRole("button", { name: "Finish Session" }));

    const alert = await screen.findByText(/Sets still waiting to sync: 1/);
    expect(alert).toBeInTheDocument();
    expect(server.completeCalls).toBe(0);
    expect(routerMock.push).not.toHaveBeenCalled();
    expect(await listPending()).toHaveLength(1);
  });

  it("reports a failed completion instead of staying silent", async () => {
    const server = await renderHud();
    server.failComplete = true;

    fireEvent.click(screen.getByRole("button", { name: "Finish Session" }));

    const alert = await screen.findByText(/Could not finish the session/);
    expect(alert).toHaveTextContent("Only an active session can be completed.");
    expect(routerMock.push).not.toHaveBeenCalled();
  });

  it("asks before abandoning, keeps queued sets by flushing them first, and returns to Today", async () => {
    const server = await renderHud();
    server.syncMode = "network";
    fireEvent.click(logSet());
    await screen.findByText("Sync Failed");
    server.syncMode = "ok";

    fireEvent.click(screen.getByRole("button", { name: "Abandon Session" }));
    const dialog = await screen.findByRole("dialog");
    expect(dialog).toHaveTextContent("Really abandon the session? Logged sets will be kept.");
    expect(server.abandonCalls).toBe(0);

    fireEvent.click(within(dialog).getByRole("button", { name: "Abandon Session" }));

    await waitFor(() => expect(routerMock.push).toHaveBeenCalledWith("/"));
    expect(server.abandonCalls).toBe(1);
    // The queued set was delivered before the session was closed.
    expect(server.session.exercises[0].sets[0].completed_at).not.toBeNull();
    expect(await listPending()).toHaveLength(0);
  });

  it("discards what could not be delivered when abandoning", async () => {
    const server = await renderHud();
    server.syncMode = "network";
    fireEvent.click(logSet());
    await screen.findByText("Sync Failed");

    fireEvent.click(screen.getByRole("button", { name: "Abandon Session" }));
    const dialog = await screen.findByRole("dialog");
    fireEvent.click(within(dialog).getByRole("button", { name: "Abandon Session" }));

    await waitFor(() => expect(routerMock.push).toHaveBeenCalledWith("/"));
    expect(await listPending()).toHaveLength(0);
  });

  it("can be cancelled without touching the session", async () => {
    const server = await renderHud();

    fireEvent.click(screen.getByRole("button", { name: "Abandon Session" }));
    const dialog = await screen.findByRole("dialog");
    fireEvent.click(within(dialog).getByRole("button", { name: "Cancel" }));

    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(server.abandonCalls).toBe(0);
  });

  it("reports a failed abandon", async () => {
    const server = await renderHud();
    server.failAbandon = true;

    fireEvent.click(screen.getByRole("button", { name: "Abandon Session" }));
    const dialog = await screen.findByRole("dialog");
    fireEvent.click(within(dialog).getByRole("button", { name: "Abandon Session" }));

    expect(await screen.findByText(/Could not abandon the session/)).toBeInTheDocument();
    expect(routerMock.push).not.toHaveBeenCalled();
  });

  it.each([
    ["completed", "Session Complete"],
    ["abandoned", "Session Abandoned"],
  ] as const)("shows a %s session read-only with a way back", async (status, title) => {
    await renderHud(makeSession({ status }));

    expect(screen.getByText(title)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Log Set" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Finish Session" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Abandon Session" })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Back to Today" })).toHaveAttribute("href", "/");
  });

  it("renders in German like the /de route", async () => {
    installSessionServer();
    renderWithProviders(<BerserkerView sessionId="sess-1" />, { language: "de" });

    expect(await screen.findByRole("button", { name: "Satz protokollieren" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Einheit abbrechen" })).toBeInTheDocument();
  });
});
