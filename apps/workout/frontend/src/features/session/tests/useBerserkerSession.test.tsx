import { renderHook, act, waitFor } from "@testing-library/react";
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { clearQueue, enqueueSet, listPending } from "@/features/offline_sync";
import { closeDbForTests } from "@/features/offline_sync/db";
import { createQueryWrapper } from "@/tests/test-utils";
import { PendingSetsError, useBerserkerSession } from "../hooks/useBerserkerSession";
import { installSessionServer, makeExercise, makeSession, makeSet } from "./fixtures";

beforeEach(async () => {
  localStorage.clear();
  localStorage.setItem("alfheim_active_household_id", "hh-1");
  await clearQueue();
});

afterEach(async () => {
  await clearQueue();
  await closeDbForTests();
});

async function mountHook(session = makeSession()) {
  const server = installSessionServer(session);
  const view = renderHook(() => useBerserkerSession(session.id), { wrapper: createQueryWrapper() });
  await waitFor(() => expect(view.result.current.session).not.toBeNull());
  return { server, ...view };
}

describe("useBerserkerSession cursor", () => {
  it("starts at the first open set of the first exercise", async () => {
    const { result } = await mountHook();

    expect(result.current.cursor.exercise?.id).toBe("ex-bench");
    expect(result.current.cursor.set?.id).toBe("set-b1");
    expect(result.current.cursor.setIndex).toBe(0);
    expect(result.current.isSessionFinished).toBe(false);
  });

  it("skips sets the server already has and resumes mid-exercise", async () => {
    const done = makeSet({ id: "set-b1", set_order: 1, completed_at: "2026-08-16T09:10:00Z", actual_reps: 8 });
    const session = makeSession({
      exercises: [
        makeExercise("ex-bench", "Bench Press", [done, makeSet({ id: "set-b2", set_order: 2 })]),
        makeExercise("ex-squat", "Squat", [makeSet({ id: "set-s1", set_order: 1 })], 2),
      ],
    });

    const { result } = await mountHook(session);

    expect(result.current.cursor.set?.id).toBe("set-b2");
    expect(result.current.cursor.setIndex).toBe(1);
  });

  it("continues with the next exercise once every set of the first is done", async () => {
    const session = makeSession({
      exercises: [
        makeExercise("ex-bench", "Bench Press", [makeSet({ id: "set-b1", set_order: 1, completed_at: "2026-08-16T09:10:00Z" })]),
        makeExercise("ex-squat", "Squat", [makeSet({ id: "set-s1", set_order: 1 })], 2),
      ],
    });

    const { result } = await mountHook(session);

    expect(result.current.cursor.exercise?.id).toBe("ex-squat");
  });

  it("reports a finished session when every set is complete", async () => {
    const session = makeSession({
      exercises: [makeExercise("ex-bench", "Bench Press", [makeSet({ id: "a", set_order: 1, completed_at: "2026-08-16T09:10:00Z" })])],
    });

    const { result } = await mountHook(session);

    expect(result.current.cursor.set).toBeNull();
    expect(result.current.isSessionFinished).toBe(true);
  });

  it("has no cursor for a session that is not active", async () => {
    const { result } = await mountHook(makeSession({ status: "completed" }));

    expect(result.current.isActive).toBe(false);
    expect(result.current.cursor.set).toBeNull();
    expect(result.current.isSessionFinished).toBe(false);
  });

  it("tolerates a null exercises or sets payload", async () => {
    const session = makeSession();
    (session as unknown as { exercises: unknown }).exercises = null;
    const { result } = await mountHook(session);

    expect(result.current.exercises).toEqual([]);
    expect(result.current.cursor.set).toBeNull();
  });
});

describe("useBerserkerSession logging", () => {
  it("advances the cursor locally the moment a set is queued", async () => {
    const { result, server } = await mountHook();
    server.syncMode = "network";

    await act(async () => {
      await result.current.logActiveSet(8, 60);
    });

    expect(result.current.cursor.set?.id).toBe("set-b2");
    expect(result.current.restTimer.isRunning).toBe(true);
    expect(await listPending()).toHaveLength(1);
  });

  it("does nothing when there is no open set", async () => {
    const { result, server } = await mountHook(makeSession({ exercises: [] }));

    await act(async () => {
      await result.current.logActiveSet(8, 60);
    });

    expect(server.syncBatches).toHaveLength(0);
  });

  it("sends the set order and warm-up flag of the cursor set", async () => {
    const session = makeSession({
      exercises: [
        makeExercise("ex-bench", "Bench Press", [makeSet({ id: "warm", set_order: 3, is_warmup: true })]),
      ],
    });
    const { result, server } = await mountHook(session);

    await act(async () => {
      await result.current.logActiveSet(12, 20);
    });

    await waitFor(() => expect(server.syncBatches).toHaveLength(1));
    expect(server.syncBatches[0][0]).toMatchObject({ set_order: 3, is_warmup: true, actual_reps: 12, actual_weight_kg: 20 });
  });

  it("gives the slot back when its queued set is dropped", async () => {
    const { result, server } = await mountHook();
    server.syncMode = "inactive";

    await act(async () => {
      await result.current.logActiveSet(8, 60);
    });

    await waitFor(() => expect(result.current.syncQueue.droppedKeys).toHaveLength(1));
    expect(result.current.cursor.set?.id).toBe("set-b1");
  });

  it("treats slots with queued sets from before a reload as done", async () => {
    await enqueueSet({
      sessionId: "sess-1",
      sessionExerciseId: "ex-bench",
      setOrder: 1,
      actualReps: 8,
      actualWeightKg: 60,
    });
    const { result } = await mountHook();

    await waitFor(() => expect(result.current.cursor.set?.id).toBe("set-b2"));
  });

  it("records an error when the set cannot be queued", async () => {
    const { result } = await mountHook();
    const original = indexedDB.open.bind(indexedDB);
    await closeDbForTests();
    indexedDB.open = (() => {
      throw new Error("storage blocked");
    }) as typeof indexedDB.open;

    try {
      await act(async () => {
        await result.current.logActiveSet(8, 60);
      });
      expect(result.current.logError).toBeInstanceOf(Error);
      expect(result.current.cursor.set?.id).toBe("set-b1");
      expect(result.current.isLogging).toBe(false);
    } finally {
      indexedDB.open = original;
    }
  });
});

describe("useBerserkerSession finish and abandon", () => {
  it("completes once the queue is empty", async () => {
    const { result, server } = await mountHook();

    await act(async () => {
      await result.current.finishSession();
    });

    expect(server.completeCalls).toBe(1);
  });

  it("throws PendingSetsError and does not complete while sets are queued", async () => {
    const { result, server } = await mountHook();
    server.syncMode = "network";
    await act(async () => {
      await result.current.logActiveSet(8, 60);
    });

    let error: unknown;
    await act(async () => {
      error = await result.current.finishSession().catch((e: unknown) => e);
    });

    expect(error).toBeInstanceOf(PendingSetsError);
    expect((error as PendingSetsError).count).toBe(1);
    expect(server.completeCalls).toBe(0);
  });

  it("abandons through the sync-aware flow", async () => {
    const { result, server } = await mountHook();

    await act(async () => {
      await result.current.abandonSession();
    });

    expect(server.abandonCalls).toBe(1);
  });
});
