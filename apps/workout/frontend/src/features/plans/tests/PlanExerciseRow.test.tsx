import { screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { mockExercises } from "@/tests/mocks/handlers";
import { renderWithI18n } from "@/tests/test-utils";
import type { ExerciseRead } from "@/features/exercises";
import { PlanExerciseRow } from "../components/PlanExerciseRow";
import type { PlanExerciseRead, PlanSetRead } from "../types";

const exercises = mockExercises as unknown as ExerciseRead[];

function planSet(overrides: Partial<PlanSetRead> = {}): PlanSetRead {
  return {
    id: "set-1",
    set_order: 1,
    target_reps: 8,
    target_weight_type: "default",
    target_weight_kg: null,
    offset_kg: null,
    is_warmup: false,
    ...overrides,
  };
}

function renderRow(sets: PlanSetRead[], availableExercises = exercises) {
  const exercise: PlanExerciseRead = { id: "pe-1", exercise_id: "ex-1", exercise_order: 1, sets };
  const handlers = {
    onRemoveExercise: vi.fn(),
    onAddSet: vi.fn(),
    onUpdateSet: vi.fn(),
    onRemoveSet: vi.fn(),
  };
  renderWithI18n(<PlanExerciseRow exercise={exercise} availableExercises={availableExercises} {...handlers} />);
  return handlers;
}

describe("PlanExerciseRow", () => {
  it("shows the exercise with its translated muscle group", () => {
    renderRow([planSet()]);

    expect(screen.getByRole("heading", { name: "Bench Press" })).toBeInTheDocument();
    expect(screen.getByText("Chest")).toBeInTheDocument();
  });

  it("falls back to the id for an exercise that is no longer in the catalog", () => {
    renderRow([planSet()], []);
    expect(screen.getByRole("heading", { name: "ex-1" })).toBeInTheDocument();
  });

  it("updates the reps, treating an empty field as no target", () => {
    const { onUpdateSet } = renderRow([planSet()]);

    fireEvent.change(screen.getByLabelText("Reps #1"), { target: { value: "12" } });
    fireEvent.change(screen.getByLabelText("Reps #1"), { target: { value: "" } });

    expect(onUpdateSet).toHaveBeenNthCalledWith(1, 0, { target_reps: 12 });
    expect(onUpdateSet).toHaveBeenNthCalledWith(2, 0, { target_reps: null });
  });

  it("switches the weight mode and seeds the matching field", () => {
    const { onUpdateSet } = renderRow([planSet()]);
    const mode = screen.getByLabelText("Target Weight Mode #1");

    fireEvent.change(mode, { target: { value: "absolute" } });
    fireEvent.change(mode, { target: { value: "offset" } });

    expect(onUpdateSet).toHaveBeenNthCalledWith(1, 0, {
      target_weight_type: "absolute",
      target_weight_kg: 50,
      offset_kg: null,
    });
    expect(onUpdateSet).toHaveBeenNthCalledWith(2, 0, {
      target_weight_type: "offset",
      target_weight_kg: null,
      offset_kg: 2.5,
    });
  });

  it("edits an absolute weight with a translated unit", () => {
    const { onUpdateSet } = renderRow([planSet({ target_weight_type: "absolute", target_weight_kg: 80 })]);

    expect(screen.getByText("kg")).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Weight #1"), { target: { value: "82.5" } });
    expect(onUpdateSet).toHaveBeenCalledWith(0, { target_weight_kg: 82.5 });
  });

  it("edits an offset with a translated placeholder", () => {
    const { onUpdateSet } = renderRow([planSet({ target_weight_type: "offset", offset_kg: 5 })]);

    expect(screen.getByPlaceholderText("Offset (kg)")).toHaveValue(5);
    fireEvent.change(screen.getByLabelText("Offset (kg) #1"), { target: { value: "" } });
    expect(onUpdateSet).toHaveBeenCalledWith(0, { offset_kg: null });
  });

  it("toggles the warm-up flag and removes sets and the exercise", () => {
    const { onUpdateSet, onRemoveSet, onRemoveExercise, onAddSet } = renderRow([
      planSet(),
      planSet({ id: "set-2", set_order: 2 }),
    ]);

    fireEvent.click(screen.getAllByRole("checkbox", { name: "Warm-up Set" })[1]);
    fireEvent.click(screen.getByRole("button", { name: "Remove Set #2" }));
    fireEvent.click(screen.getByRole("button", { name: "Add Set" }));
    fireEvent.click(screen.getByRole("button", { name: "Remove Exercise: Bench Press" }));

    expect(onUpdateSet).toHaveBeenCalledWith(1, { is_warmup: true });
    expect(onRemoveSet).toHaveBeenCalledWith(1);
    expect(onAddSet).toHaveBeenCalled();
    expect(onRemoveExercise).toHaveBeenCalled();
  });

  it("wraps a very long exercise name", () => {
    const longName = "Einbeiniges Kreuzheben".repeat(10);
    renderRow([planSet()], [{ ...exercises[0], name: longName }]);

    const title = screen.getByRole("heading", { name: longName });
    expect(title).toHaveClass("break-words");
    expect(title.parentElement).toHaveClass("min-w-0");
  });
});
