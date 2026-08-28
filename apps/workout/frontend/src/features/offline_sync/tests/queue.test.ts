import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { http, HttpResponse } from "msw";
import { server } from "@/tests/mocks/server";
import {
  clearQueue,
  countPending,
  enqueueSet,
  groupBySession,
  listPending,
  listPendingForSession,
  recordFailedAttempt,
  removeAcked,
  MAX_SYNC_ATTEMPTS,
} from "../queue";
import { flushQueue } from "../flush";

const SESSION = "sess-1";
const EXERCISE = "sess-ex-1";

function enqueue(key: string, overrides: Partial<Parameters<typeof enqueueSet>[0]> = {}) {
  return enqueueSet({
    sessionId: SESSION,
    sessionExerciseId: EXERCISE,
    setOrder: 0,
    actualReps: 8,
    actualWeightKg: 60,
    clientIdempotencyKey: key,
    ...overrides,
  });
}

beforeEach(async () => {
  localStorage.clear();
  localStorage.setItem("alfheim_active_household_id", "hh-1");
  await clearQueue();
});

afterEach(async () => {
  await clearQueue();
});

describe("queue persistence", () => {
  it("stores a logged set and reports it as pending", async () => {
    await enqueue("key-1");

    expect(await countPending()).toBe(1);
    const pending = await listPending();
    expect(pending[0].clientIdempotencyKey).toBe("key-1");
    expect(pending[0].attempts).toBe(0);
  });

  it("overwrites rather than duplicating when the same key is logged twice", async () => {
    await enqueue("key-1", { actualReps: 8 });
    await enqueue("key-1", { actualReps: 10 });

    const pending = await listPending();
    expect(pending).toHaveLength(1);
    expect(pending[0].actualReps).toBe(10);
  });

  it("returns entries oldest first", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-16T10:00:00Z"));
    await enqueue("older");
    vi.setSystemTime(new Date("2026-08-16T10:05:00Z"));
    await enqueue("newer");
    vi.useRealTimers();

    const pending = await listPending();
    expect(pending.map((entry) => entry.clientIdempotencyKey)).toEqual(["older", "newer"]);
  });

  it("filters by session via the index", async () => {
    await enqueue("a");
    await enqueue("b", { sessionId: "sess-2" });

    const forSession = await listPendingForSession(SESSION);
    expect(forSession.map((entry) => entry.clientIdempotencyKey)).toEqual(["a"]);
  });

  it("removeAcked tolerates keys that are not present", async () => {
    await enqueue("a");
    await removeAcked(["a", "does-not-exist"]);
    expect(await countPending()).toBe(0);
  });

  it("drops an entry only after MAX_SYNC_ATTEMPTS failures", async () => {
    await enqueue("a");

    for (let attempt = 1; attempt < MAX_SYNC_ATTEMPTS; attempt += 1) {
      const dropped = await recordFailedAttempt(["a"]);
      expect(dropped).toEqual([]);
      expect(await countPending()).toBe(1);
    }

    const dropped = await recordFailedAttempt(["a"]);
    expect(dropped).toEqual(["a"]);
    expect(await countPending()).toBe(0);
  });

  it("groups entries by session id", () => {
    const grouped = groupBySession([
      { sessionId: "s1" } as never,
      { sessionId: "s2" } as never,
      { sessionId: "s1" } as never,
    ]);
    expect(grouped.get("s1")).toHaveLength(2);
    expect(grouped.get("s2")).toHaveLength(1);
  });

  it("groupBySession tolerates a null payload", () => {
    expect(groupBySession(null as never).size).toBe(0);
  });
});

describe("flushQueue", () => {
  it("is a no-op on an empty queue", async () => {
    const result = await flushQueue();
    expect(result).toEqual({ ackedCount: 0, remainingCount: 0, droppedKeys: [], error: null });
  });

  it("removes acknowledged entries and leaves the queue empty", async () => {
    server.use(
      http.post(/\/sets\/sync$/, async ({ request }) => {
        const body = (await request.json()) as { items: { client_idempotency_key: string }[] };
        const acked = body.items.map((item) => item.client_idempotency_key);
        return HttpResponse.json({
          acked,
          server_ids: Object.fromEntries(acked.map((key) => [key, `server-${key}`])),
        });
      })
    );

    await enqueue("key-1");
    await enqueue("key-2", { setOrder: 1 });

    const result = await flushQueue();

    expect(result.ackedCount).toBe(2);
    expect(result.remainingCount).toBe(0);
    expect(result.error).toBeNull();
    expect(await countPending()).toBe(0);
  });

  it("replaying an already-synced batch is safe and does not duplicate", async () => {
    const seen: string[][] = [];
    server.use(
      http.post(/\/sets\/sync$/, async ({ request }) => {
        const body = (await request.json()) as { items: { client_idempotency_key: string }[] };
        const acked = body.items.map((item) => item.client_idempotency_key);
        seen.push(acked);
        return HttpResponse.json({ acked, server_ids: {} });
      })
    );

    await enqueue("retry-key");
    await flushQueue();
    // Second flush has nothing left to send — the first one cleared the queue.
    const second = await flushQueue();

    expect(seen).toHaveLength(1);
    expect(second.ackedCount).toBe(0);
    expect(await countPending()).toBe(0);
  });

  it("keeps entries queued when the request fails, and reports the error", async () => {
    server.use(http.post(/\/sets\/sync$/, () => HttpResponse.error()));

    await enqueue("key-1");
    const result = await flushQueue();

    expect(result.ackedCount).toBe(0);
    expect(result.remainingCount).toBe(1);
    expect(result.error).not.toBeNull();
    expect((await listPending())[0].attempts).toBe(1);
  });

  it("counts an attempt against items the backend silently skipped", async () => {
    // The backend skips items whose session_exercise_id is not on the session:
    // they come back with an empty acked list rather than an error.
    server.use(http.post(/\/sets\/sync$/, () => HttpResponse.json({ acked: [], server_ids: {} })));

    await enqueue("orphan");
    const result = await flushQueue();

    expect(result.ackedCount).toBe(0);
    expect(result.remainingCount).toBe(1);
    expect(result.error).toBeNull();
    expect((await listPending())[0].attempts).toBe(1);
  });

  it("eventually drops an entry the backend never acknowledges", async () => {
    server.use(http.post(/\/sets\/sync$/, () => HttpResponse.json({ acked: [], server_ids: {} })));

    await enqueue("orphan");
    for (let attempt = 0; attempt < MAX_SYNC_ATTEMPTS; attempt += 1) {
      await flushQueue();
    }

    expect(await countPending()).toBe(0);
  });

  it("sends one request per session", async () => {
    const sessions: string[] = [];
    server.use(
      http.post(/\/sessions\/([^/]+)\/sets\/sync$/, async ({ request }) => {
        sessions.push(new URL(request.url).pathname);
        const body = (await request.json()) as { items: { client_idempotency_key: string }[] };
        return HttpResponse.json({
          acked: body.items.map((item) => item.client_idempotency_key),
          server_ids: {},
        });
      })
    );

    await enqueue("a");
    await enqueue("b", { sessionId: "sess-2" });

    await flushQueue();

    expect(sessions).toHaveLength(2);
    expect(sessions.some((path) => path.includes("sess-1"))).toBe(true);
    expect(sessions.some((path) => path.includes("sess-2"))).toBe(true);
  });
});
