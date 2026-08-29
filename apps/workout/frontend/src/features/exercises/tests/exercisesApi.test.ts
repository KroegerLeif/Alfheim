import { renderHook, waitFor, act } from "@testing-library/react";
import { describe, it, expect, beforeEach } from "vitest";
import { createQueryWrapper } from "@/tests/test-utils";
import {
  useAddFavorite,
  useCreateExercise,
  useDeleteExercise,
  useExerciseList,
  useFavoriteExercises,
  useUpsertExercisePreference,
  exerciseKeys,
} from "../hooks/useExercises";

describe("exercises hooks", () => {
  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem("alfheim_active_household_id", "hh-1");
  });

  it("scopes query keys by household so tenants cannot share a cache entry", () => {
    expect(exerciseKeys.list("hh-1")).not.toEqual(exerciseKeys.list("hh-2"));
    expect(exerciseKeys.all("hh-1")).toEqual(["exercises", { householdId: "hh-1" }]);
    expect(exerciseKeys.favorites("hh-1")).toEqual([
      "exercises",
      { householdId: "hh-1" },
      "favorites",
    ]);
  });

  it("fetches the exercise list via MSW", async () => {
    const { result } = renderHook(() => useExerciseList(), { wrapper: createQueryWrapper() });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data).toBeDefined();
    expect((result.current.data ?? []).length).toBeGreaterThan(0);
    expect(result.current.data?.[0]).toHaveProperty("primary_muscle");
    expect(result.current.data?.[0]).toHaveProperty("scope");
  });

  it("fetches favorite exercises via MSW", async () => {
    const { result } = renderHook(() => useFavoriteExercises(), { wrapper: createQueryWrapper() });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect((result.current.data ?? []).length).toBeGreaterThan(0);
  });

  it("creates an exercise entry", async () => {
    const { result } = renderHook(() => useCreateExercise(), { wrapper: createQueryWrapper() });

    let created: unknown = null;
    await act(async () => {
      created = await result.current.mutateAsync({
        name: "Overhead Press",
        primary_muscle: "shoulders",
        scope: "household",
      });
    });

    expect(created).toHaveProperty("id");
    expect(created).toHaveProperty("name", "Overhead Press");
  });

  it("deletes an exercise entry without parsing an empty 204 body", async () => {
    const { result } = renderHook(() => useDeleteExercise(), { wrapper: createQueryWrapper() });

    await act(async () => {
      await result.current.mutateAsync("ex-1");
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
  });

  it("adds a favorite for an exercise", async () => {
    const { result } = renderHook(() => useAddFavorite(), { wrapper: createQueryWrapper() });

    let created: unknown = null;
    await act(async () => {
      created = await result.current.mutateAsync("ex-2");
    });

    expect(created).toHaveProperty("exercise_id", "ex-2");
  });

  it("upserts an exercise preference (the plan weight-engine baseline)", async () => {
    const { result } = renderHook(() => useUpsertExercisePreference(), {
      wrapper: createQueryWrapper(),
    });

    let updated: unknown = null;
    await act(async () => {
      updated = await result.current.mutateAsync({
        id: "ex-1",
        payload: { default_target_weight_kg: 82.5 },
      });
    });

    expect(updated).toHaveProperty("default_target_weight_kg", 82.5);
    expect(updated).toHaveProperty("exercise_id", "ex-1");
  });
});
