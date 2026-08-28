import { renderHook, waitFor, act } from "@testing-library/react";
import { describe, it, expect, beforeEach } from "vitest";
import { createQueryWrapper } from "@/tests/test-utils";
import {
  useCreateEquipment,
  useDeleteEquipment,
  useEquipmentList,
  equipmentKeys,
} from "../hooks/useEquipment";

describe("equipment hooks", () => {
  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem("alfheim_active_household_id", "hh-1");
  });

  it("scopes query keys by household so tenants cannot share a cache entry", () => {
    expect(equipmentKeys.list("hh-1")).not.toEqual(equipmentKeys.list("hh-2"));
    expect(equipmentKeys.all("hh-1")).toEqual(["equipment", { householdId: "hh-1" }]);
  });

  it("fetches the equipment list via MSW", async () => {
    const { result } = renderHook(() => useEquipmentList(), { wrapper: createQueryWrapper() });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data).toBeDefined();
    expect((result.current.data ?? []).length).toBeGreaterThan(0);
    expect(result.current.data?.[0]).toHaveProperty("scope");
    expect(result.current.data?.[0]).toHaveProperty("name");
  });

  it("creates an equipment entry", async () => {
    const { result } = renderHook(() => useCreateEquipment(), { wrapper: createQueryWrapper() });

    let created: unknown = null;
    await act(async () => {
      created = await result.current.mutateAsync({ name: "Trap Bar", scope: "household" });
    });

    expect(created).toHaveProperty("id");
    expect(created).toHaveProperty("name", "Trap Bar");
  });

  it("deletes an equipment entry without parsing an empty 204 body", async () => {
    const { result } = renderHook(() => useDeleteEquipment(), { wrapper: createQueryWrapper() });

    await act(async () => {
      await result.current.mutateAsync("eq-1");
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
  });
});
