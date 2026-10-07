import { describe, it, expect } from "vitest";
import { readApiError } from "../apiError";
import { makeHttpError } from "@/tests/renderWithProviders";

describe("readApiError", () => {
  it("reads the stable code and item count from the detail object", async () => {
    const info = await readApiError(
      makeHttpError(409, { detail: { code: "location_in_use", message: "x", item_count: 3 } })
    );
    expect(info).toEqual({ status: 409, code: "location_in_use", itemCount: 3 });
  });

  it("keeps the status when the detail is a plain string", async () => {
    const info = await readApiError(makeHttpError(404, { detail: "No results" }));
    expect(info).toEqual({ status: 404, code: null, itemCount: null });
  });

  it("keeps the status when the body is not JSON", async () => {
    const info = await readApiError(makeHttpError(502));
    expect(info).toEqual({ status: 502, code: null, itemCount: null });
  });

  it("reports no status for errors that never produced a response", async () => {
    expect(await readApiError(new Error("network down"))).toEqual({
      status: null,
      code: null,
      itemCount: null,
    });
  });
});
