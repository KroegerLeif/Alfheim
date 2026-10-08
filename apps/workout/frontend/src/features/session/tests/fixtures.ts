import { http, HttpResponse } from "msw";
import { server } from "@/tests/mocks/server";
import type { SessionSetSyncItem } from "@/features/offline_sync";
import type { SessionExerciseRead, SessionSetRead, WorkoutSessionRead } from "../types";

export function makeSet(overrides: Partial<SessionSetRead> & { id: string; set_order: number }): SessionSetRead {
  return {
    target_reps: 8,
    target_weight_kg: 60,
    actual_reps: null,
    actual_weight_kg: null,
    is_warmup: false,
    completed_at: null,
    client_idempotency_key: null,
    ...overrides,
  };
}

export function makeExercise(
  id: string,
  name: string,
  sets: SessionSetRead[],
  order = 1
): SessionExerciseRead {
  return {
    id,
    exercise_id: `catalog-${id}`,
    exercise_name_snapshot: name,
    primary_muscle_snapshot: "chest",
    exercise_order: order,
    sets,
  };
}

/** Bench Press with two open sets, then a Squat whose target weight is unknown. */
export function makeSession(overrides: Partial<WorkoutSessionRead> = {}): WorkoutSessionRead {
  return {
    id: "sess-1",
    home_id: "hh-1",
    user_id: "user-1",
    plan_id: "plan-1",
    plan_day_label: "Push Day",
    started_at: "2026-08-16T09:00:00Z",
    completed_at: null,
    status: "active",
    notes: null,
    exercises: [
      makeExercise(
        "ex-bench",
        "Bench Press",
        [
          makeSet({ id: "set-b1", set_order: 1 }),
          makeSet({ id: "set-b2", set_order: 2, target_reps: 6, target_weight_kg: 65 }),
        ],
        1
      ),
      makeExercise("ex-squat", "Squat", [makeSet({ id: "set-s1", set_order: 1, target_reps: 5, target_weight_kg: null })], 2),
    ],
    ...overrides,
  };
}

export type SyncMode = "ok" | "network" | "inactive";

export interface SessionServer {
  session: WorkoutSessionRead;
  syncMode: SyncMode;
  syncBatches: SessionSetSyncItem[][];
  completeCalls: number;
  abandonCalls: number;
  failComplete: boolean;
  failAbandon: boolean;
}

/**
 * Stateful stand-in for the session endpoints: sync fills the matching open set (like the real
 * backend), complete/abandon flip the status, and each call is recorded for assertions.
 */
export function installSessionServer(initial: WorkoutSessionRead = makeSession()): SessionServer {
  const state: SessionServer = {
    session: structuredClone(initial),
    syncMode: "ok",
    syncBatches: [],
    completeCalls: 0,
    abandonCalls: 0,
    failComplete: false,
    failAbandon: false,
  };

  server.use(
    http.get(/\/sessions\/([^/]+)$/, () => HttpResponse.json(state.session)),
    http.post(/\/sessions\/([^/]+)\/sets\/sync$/, async ({ request }) => {
      const body = (await request.json()) as { items: SessionSetSyncItem[] };
      state.syncBatches.push(body.items);
      if (state.syncMode === "network") return HttpResponse.error();
      if (state.syncMode === "inactive") {
        return HttpResponse.json(
          { detail: { code: "session_not_active", message: "Session is completed." } },
          { status: 409 }
        );
      }
      for (const item of body.items) {
        const exercise = state.session.exercises.find((entry) => entry.id === item.session_exercise_id);
        const target = exercise?.sets.find((set) => set.set_order === item.set_order && set.completed_at === null);
        if (target) {
          target.completed_at = item.completed_at ?? "2026-08-16T09:30:00Z";
          target.actual_reps = item.actual_reps;
          target.actual_weight_kg = item.actual_weight_kg;
          target.client_idempotency_key = item.client_idempotency_key;
        }
      }
      return HttpResponse.json({
        acked: body.items.map((item) => item.client_idempotency_key),
        server_ids: {},
      });
    }),
    http.post(/\/sessions\/([^/]+)\/complete$/, () => {
      state.completeCalls += 1;
      if (state.failComplete) return HttpResponse.json({ detail: "Only an active session can be completed." }, { status: 400 });
      state.session = { ...state.session, status: "completed", completed_at: "2026-08-16T10:00:00Z" };
      return HttpResponse.json(state.session);
    }),
    http.post(/\/sessions\/([^/]+)\/abandon$/, () => {
      state.abandonCalls += 1;
      if (state.failAbandon) return HttpResponse.json({ detail: "Only an active session can be abandoned." }, { status: 400 });
      state.session = { ...state.session, status: "abandoned", completed_at: "2026-08-16T10:00:00Z" };
      return HttpResponse.json(state.session);
    })
  );

  return state;
}
