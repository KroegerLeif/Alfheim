import { describe, it, expect, beforeEach } from "vitest";
import { mockPlans } from "@/tests/mocks/handlers";
import { plansApi } from "../api/plansApi";

describe("plansApi", () => {
  beforeEach(() => {
    localStorage.setItem("alfheim_active_household_id", "hh-1");
  });

  it("lists plans", async () => {
    const result = await plansApi.list();
    expect(result).toHaveLength(mockPlans.length);
    expect(result[0].name).toBe("Push Pull Legs");
  });

  it("fetches a single plan by id", async () => {
    const result = await plansApi.get("plan-1");
    expect(result.id).toBe("plan-1");
    expect(result.days).toHaveLength(1);
  });

  it("creates a new plan", async () => {
    const result = await plansApi.create({
      name: "Upper Lower",
      description: "2-day split",
      is_shared: true,
    });
    expect(result.id).toBe("plan-new");
    expect(result.name).toBe("Upper Lower");
  });

  it("updates an existing plan", async () => {
    const result = await plansApi.update("plan-1", {
      name: "Push Pull Legs v2",
    });
    expect(result.name).toBe("Push Pull Legs v2");
  });

  it("deletes a plan", async () => {
    await expect(plansApi.remove("plan-1")).resolves.not.toThrow();
  });

  it("fetches resolved day targets with server-side weight engine calculations", async () => {
    const result = await plansApi.getResolvedDay("plan-1", "day-1");
    expect(result.label).toBe("Push Day");
    expect(result.exercises[0].sets[0].resolved_weight_kg).toBe(60);
  });
});
