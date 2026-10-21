import { screen } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { mockEquipment, mockExercises } from "@/tests/mocks/handlers";
import { renderWithProviders } from "@/tests/test-utils";
import { EquipmentCard } from "@/features/equipment/components/EquipmentCard";
import { EquipmentCreateForm } from "@/features/equipment/components/EquipmentCreateForm";
import { ExerciseCard } from "@/features/exercises/components/ExerciseCard";
import type { EquipmentRead } from "@/features/equipment/types";
import type { ExerciseRead } from "@/features/exercises/types";

const householdEquipment = { ...(mockEquipment[0] as EquipmentRead), name: "Shared Rack", scope: "household" } as EquipmentRead;
const personalEquipment = { ...(mockEquipment[0] as EquipmentRead), id: "eq-user", name: "My Bands", scope: "user" } as EquipmentRead;
const householdExercise = { ...(mockExercises[0] as unknown as ExerciseRead), name: "Shared Press", scope: "household" } as ExerciseRead;

function renderAll(role: string) {
  return renderWithProviders(
    <>
      <EquipmentCard equipment={householdEquipment} onDelete={vi.fn()} />
      <EquipmentCard equipment={personalEquipment} onDelete={vi.fn()} />
      <ExerciseCard
        exercise={householdExercise}
        isFavorite={false}
        onToggleFavorite={vi.fn()}
        onSetBaseline={vi.fn()}
        onDelete={vi.fn()}
      />
      <EquipmentCreateForm onSuccess={vi.fn()} onCancel={vi.fn()} />
    </>,
    { role }
  );
}

const scopeOptions = () =>
  Array.from((screen.getByLabelText("Scope") as HTMLSelectElement).options).map((option) => option.value);

const HOUSEHOLD_DELETES = ["Delete Shared Rack", "Delete Shared Press"];

describe("household role gating", () => {
  it("GUEST keeps personal entries but cannot touch household ones", () => {
    renderAll("GUEST");
    for (const name of HOUSEHOLD_DELETES) expect(screen.queryByRole("button", { name })).toBeNull();
    expect(screen.getByRole("button", { name: "Delete My Bands" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Add to Favorites" })).toBeEnabled();
    expect(scopeOptions()).toEqual(["user"]);
  });

  it("MEMBER can add household entries but their deletes are disabled with a hint", () => {
    renderAll("MEMBER");
    expect(scopeOptions()).toEqual(["household", "user"]);
    for (const name of HOUSEHOLD_DELETES) {
      const button = screen.getByRole("button", { name });
      expect(button).toBeDisabled();
      expect(button.closest("[title]")).toHaveAttribute("title", expect.stringMatching(/admins and owners/));
    }
    expect(screen.getByRole("button", { name: "Delete My Bands" })).toBeEnabled();
  });

  it("ADMIN can delete household entries", () => {
    renderAll("ADMIN");
    for (const name of HOUSEHOLD_DELETES) expect(screen.getByRole("button", { name })).toBeEnabled();
    expect(screen.queryByTestId("permission-hint")).toBeNull();
  });
});
