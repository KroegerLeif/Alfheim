import { describe, it, expect } from "vitest";
import { ApiError } from "../api";
import { describeError } from "../errors";

const t = (key: string) => `[${key}]`;

describe("describeError", () => {
  it("maps a known backend code to its dedicated message", () => {
    const error = new ApiError(409, "Session is completed.", "session_not_active");
    expect(describeError(error, t, "workout.saveFailed")).toBe("[workout.errorSessionNotActive]");
  });

  it("appends the server detail of other API errors to the localized fallback", () => {
    const error = new ApiError(400, "Plan day not found.");
    expect(describeError(error, t, "workout.startFailed")).toBe("[workout.startFailed]: Plan day not found.");
  });

  it("uses the localized fallback alone when the API gave no detail", () => {
    expect(describeError(new ApiError(500, ""), t, "workout.saveFailed")).toBe("[workout.saveFailed]");
  });

  it("does not leak raw network error text", () => {
    expect(describeError(new TypeError("Failed to fetch"), t, "workout.saveFailed")).toBe("[workout.saveFailed]");
    expect(describeError(undefined, t, "workout.saveFailed")).toBe("[workout.saveFailed]");
  });

  it("falls back for an unknown code with a message", () => {
    const error = new ApiError(403, "Nope", "something_else");
    expect(describeError(error, t, "workout.saveFailed")).toBe("[workout.saveFailed]: Nope");
  });
});
