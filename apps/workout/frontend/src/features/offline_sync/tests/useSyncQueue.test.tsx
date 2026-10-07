import { renderHook, act, waitFor } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { server } from "@/tests/mocks/server";
import { createQueryWrapper } from "@/tests/test-utils";
import { closeDbForTests } from "../db";
import { clearQueue, listPending, MAX_SYNC_ATTEMPTS } from "../queue";
import { useSyncQueue } from "../hooks/useSyncQueue";

const input = {
  sessionId: "sess-1",
  sessionExerciseId: "sess-ex-1",
  setOrder: 1,
  actualReps: 8,
  actualWeightKg: 60,
};

beforeEach(async () => {
  localStorage.clear();
  localStorage.setItem("alfheim_active_household_id", "hh-1");
  await clearQueue();
});

afterEach(async () => {
  await clearQueue();
  await closeDbForTests();
});

describe("useSyncQueue", () => {
  it("persists the set, hands back its key, and syncs in the background", async () => {
    const { result } = renderHook(() => useSyncQueue(), { wrapper: createQueryWrapper() });

    let entry: Awaited<ReturnType<typeof result.current.logSet>> | undefined;
    await act(async () => {
      entry = await result.current.logSet(input);
    });

    expect(entry?.clientIdempotencyKey).toBeTruthy();
    await waitFor(async () => expect(await listPending()).toHaveLength(0));
    await waitFor(() => expect(result.current.pendingCount).toBe(0));
    expect(result.current.droppedKeys).toEqual([]);
  });

  it("keeps the set queued and reports the error while the server is unreachable", async () => {
    server.use(http.post(/\/sessions\/([^/]+)\/sets\/sync$/, () => HttpResponse.error()));
    const { result } = renderHook(() => useSyncQueue(), { wrapper: createQueryWrapper() });

    await act(async () => {
      await result.current.logSet(input);
    });

    await waitFor(() => expect(result.current.lastError).not.toBeNull());
    expect(result.current.pendingCount).toBe(1);
    expect(await listPending()).toHaveLength(1);
  });

  it("surfaces sets dropped after repeated failures and lets the caller dismiss the warning", async () => {
    server.use(http.post(/\/sessions\/([^/]+)\/sets\/sync$/, () => HttpResponse.error()));
    const onDropped = vi.fn();
    const { result } = renderHook(() => useSyncQueue({ onDropped }), { wrapper: createQueryWrapper() });

    let key = "";
    await act(async () => {
      key = (await result.current.logSet(input)).clientIdempotencyKey;
    });
    await waitFor(() => expect(result.current.isSyncing).toBe(false));

    for (let attempt = 1; attempt < MAX_SYNC_ATTEMPTS; attempt += 1) {
      await act(async () => {
        await result.current.flushNow();
      });
    }

    expect(onDropped).toHaveBeenCalledWith([key]);
    expect(result.current.droppedKeys).toEqual([key]);
    expect(result.current.pendingCount).toBe(0);

    act(() => result.current.dismissDropped());
    expect(result.current.droppedKeys).toEqual([]);
  });

  it("reports sets rejected by a finished session as dropped", async () => {
    server.use(
      http.post(/\/sessions\/([^/]+)\/sets\/sync$/, () =>
        HttpResponse.json({ detail: { code: "session_not_active", message: "done" } }, { status: 409 })
      )
    );
    const onDropped = vi.fn();
    const { result } = renderHook(() => useSyncQueue({ onDropped }), { wrapper: createQueryWrapper() });

    await act(async () => {
      await result.current.logSet(input);
    });

    await waitFor(() => expect(result.current.droppedKeys).toHaveLength(1));
    expect(onDropped).toHaveBeenCalledTimes(1);
    expect(result.current.pendingCount).toBe(0);
  });

  it("flushNow resolves with the flush outcome", async () => {
    const { result } = renderHook(() => useSyncQueue(), { wrapper: createQueryWrapper() });

    let outcome: Awaited<ReturnType<typeof result.current.flushNow>> = null;
    await act(async () => {
      outcome = await result.current.flushNow();
    });

    expect(outcome).toEqual({ ackedCount: 0, remainingCount: 0, droppedKeys: [], error: null });
  });
});
