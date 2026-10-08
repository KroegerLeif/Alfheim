import { http, HttpResponse } from "msw";
import { describe, it, expect, beforeEach } from "vitest";
import { server } from "@/tests/mocks/server";
import { mockSession } from "@/tests/mocks/handlers";
import { sessionsApi } from "../api/sessionsApi";

beforeEach(() => {
  localStorage.clear();
  localStorage.setItem("alfheim_active_household_id", "hh-1");
});

describe("sessionsApi", () => {
  it("lists with the status filter and paging as query parameters", async () => {
    let url: URL | undefined;
    server.use(
      http.get(/\/sessions$/, ({ request }) => {
        url = new URL(request.url);
        return HttpResponse.json([]);
      })
    );

    await sessionsApi.list({ status_filter: "active", limit: 1, offset: 5 });

    expect(url?.searchParams.get("status_filter")).toBe("active");
    expect(url?.searchParams.get("limit")).toBe("1");
    expect(url?.searchParams.get("offset")).toBe("5");
  });

  it("starts a plan day session with both ids", async () => {
    let body: unknown;
    server.use(
      http.post(/\/sessions$/, async ({ request }) => {
        body = await request.json();
        return HttpResponse.json(mockSession, { status: 201 });
      })
    );

    const session = await sessionsApi.start({ plan_id: "plan-1", plan_day_id: "day-2" });

    expect(body).toEqual({ plan_id: "plan-1", plan_day_id: "day-2" });
    expect(session.id).toBe("sess-1");
  });

  it("fetches, completes and abandons by id", async () => {
    expect((await sessionsApi.get("sess-1")).plan_day_label).toBe("Push Day");
    expect((await sessionsApi.complete("sess-1")).status).toBe("completed");
    expect((await sessionsApi.abandon("sess-1")).status).toBe("abandoned");
  });

  it("surfaces the backend's detail as the error message", async () => {
    server.use(
      http.post(/\/sessions\/([^/]+)\/complete$/, () =>
        HttpResponse.json({ detail: "Only an active session can be completed." }, { status: 400 })
      )
    );

    await expect(sessionsApi.complete("sess-1")).rejects.toMatchObject({
      status: 400,
      message: "Only an active session can be completed.",
    });
  });
});
