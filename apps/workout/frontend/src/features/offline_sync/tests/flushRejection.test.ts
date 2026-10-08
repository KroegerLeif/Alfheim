import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { http, HttpResponse } from "msw";
import { server } from "@/tests/mocks/server";
import { closeDbForTests } from "../db";
import { clearPendingForSession, clearQueue, countPending, enqueueSet, listPending } from "../queue";
import { flushQueue } from "../flush";

function enqueue(key: string, sessionId = "sess-1") {
  return enqueueSet({
    sessionId,
    sessionExerciseId: "sess-ex-1",
    setOrder: 0,
    actualReps: 8,
    actualWeightKg: 60,
    clientIdempotencyKey: key,
  });
}

const notActive = () =>
  HttpResponse.json(
    { detail: { code: "session_not_active", message: "Session is completed; sets can only be logged on an active session." } },
    { status: 409 }
  );

beforeEach(async () => {
  localStorage.clear();
  localStorage.setItem("alfheim_active_household_id", "hh-1");
  await clearQueue();
});

afterEach(async () => {
  await clearQueue();
  await closeDbForTests();
});

describe("flushQueue with a finalized session", () => {
  it("drops the entries immediately instead of retrying them", async () => {
    server.use(http.post(/\/sessions\/([^/]+)\/sets\/sync$/, notActive));
    await enqueue("late-1");
    await enqueue("late-2");

    const result = await flushQueue();

    expect(result.droppedKeys.sort()).toEqual(["late-1", "late-2"]);
    expect(result.ackedCount).toBe(0);
    expect(result.remainingCount).toBe(0);
    expect(await countPending()).toBe(0);
  });

  it("still delivers the other sessions of the same flush", async () => {
    server.use(
      http.post(/\/sessions\/sess-done\/sets\/sync$/, notActive),
      http.post(/\/sessions\/sess-live\/sets\/sync$/, async ({ request }) => {
        const body = (await request.json()) as { items: { client_idempotency_key: string }[] };
        const keys = body.items.map((item) => item.client_idempotency_key);
        return HttpResponse.json({ acked: keys, server_ids: {} });
      })
    );
    await enqueue("stale", "sess-done");
    await enqueue("fresh", "sess-live");

    const result = await flushQueue();

    expect(result.droppedKeys).toEqual(["stale"]);
    expect(result.ackedCount).toBe(1);
    expect(await countPending()).toBe(0);
  });

  it("keeps treating other 4xx and network errors as retryable", async () => {
    server.use(http.post(/\/sessions\/([^/]+)\/sets\/sync$/, () => HttpResponse.json({ detail: "bad" }, { status: 400 })));
    await enqueue("retry-me");

    const result = await flushQueue();

    expect(result.droppedKeys).toEqual([]);
    expect(result.remainingCount).toBe(1);
    expect((await listPending())[0].attempts).toBe(1);
  });
});

describe("flushQueue serialization", () => {
  it("never sends the same batch twice when flushes overlap", async () => {
    const received: string[][] = [];
    server.use(
      http.post(/\/sessions\/([^/]+)\/sets\/sync$/, async ({ request }) => {
        const body = (await request.json()) as { items: { client_idempotency_key: string }[] };
        const keys = body.items.map((item) => item.client_idempotency_key);
        received.push(keys);
        return HttpResponse.json({ acked: keys, server_ids: {} });
      })
    );
    await enqueue("only-once");

    const [first, second] = await Promise.all([flushQueue(), flushQueue()]);

    expect(received).toEqual([["only-once"]]);
    expect(first.ackedCount).toBe(1);
    expect(second.ackedCount).toBe(0);
  });

  it("keeps the chain alive after a flush failed", async () => {
    await enqueue("after-error");
    const sync = vi.fn(async () => HttpResponse.json({ acked: ["after-error"], server_ids: {} }));
    server.use(http.post(/\/sessions\/([^/]+)\/sets\/sync$/, sync));

    const result = await flushQueue();

    expect(result.ackedCount).toBe(1);
  });
});

describe("clearPendingForSession", () => {
  it("removes only the entries of that session and reports how many", async () => {
    await enqueue("a", "sess-1");
    await enqueue("b", "sess-1");
    await enqueue("c", "sess-2");

    expect(await clearPendingForSession("sess-1")).toBe(2);

    expect((await listPending()).map((entry) => entry.clientIdempotencyKey)).toEqual(["c"]);
  });

  it("is a no-op for a session without queued sets", async () => {
    expect(await clearPendingForSession("nothing")).toBe(0);
  });
});
