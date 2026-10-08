import { screen, fireEvent, within } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { mockExercises, mockPlans } from "@/tests/mocks/handlers";
import { renderWithI18n } from "@/tests/test-utils";
import type { ExerciseRead } from "@/features/exercises";
import { PlanEditor } from "../components/PlanEditor";
import type { PlanRead } from "../types";

const exercises = mockExercises as unknown as ExerciseRead[];

function renderEditor(props: Partial<React.ComponentProps<typeof PlanEditor>> = {}) {
  const onSave = vi.fn().mockResolvedValue(undefined);
  const onCancel = vi.fn();
  renderWithI18n(
    <PlanEditor availableExercises={exercises} onSave={onSave} onCancel={onCancel} {...props} />
  );
  return { onSave, onCancel };
}

describe("PlanEditor", () => {
  it("requires a plan name before saving", () => {
    const { onSave } = renderEditor();

    fireEvent.submit(screen.getByRole("button", { name: "Save" }).closest("form") as HTMLFormElement);

    expect(onSave).not.toHaveBeenCalled();
  });

  it("names unlabeled days with the localized fallback in the tabs and the payload", () => {
    const { onSave } = renderEditor();

    fireEvent.change(screen.getByLabelText(/Plan Name/), { target: { value: "My Plan" } });
    fireEvent.click(screen.getByRole("button", { name: "Add Day" }));

    expect(screen.getByRole("button", { name: "Day 1" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Day 2" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    const payload = onSave.mock.calls[0][0];
    expect(payload.name).toBe("My Plan");
    expect(payload.days.map((d: { label: string }) => d.label)).toEqual(["Day 1", "Day 2"]);
  });

  it("does not submit the form when editing buttons are used", () => {
    const { onSave } = renderEditor();

    fireEvent.change(screen.getByLabelText(/Plan Name/), { target: { value: "My Plan" } });
    fireEvent.change(screen.getByRole("combobox", { name: "Add Exercise" }), { target: { value: "ex-1" } });
    fireEvent.click(screen.getAllByRole("button", { name: "Add Exercise" })[0]);
    fireEvent.click(screen.getByRole("button", { name: "Add Set" }));
    fireEvent.click(screen.getByRole("button", { name: "Remove Set #2" }));
    fireEvent.click(screen.getByRole("button", { name: "Remove Day" }));

    expect(onSave).not.toHaveBeenCalled();
  });

  it("lists exercises with their translated muscle group", () => {
    renderEditor();

    const select = screen.getByRole("combobox", { name: "Add Exercise" });
    expect(within(select).getByRole("option", { name: "Bench Press (Chest)" })).toBeInTheDocument();
    expect(within(select).getByRole("option", { name: "Squat (Quads)" })).toBeInTheDocument();
  });

  it("shows the failure of the last save next to the buttons", () => {
    renderEditor({ errorMessage: "Could not save the plan: Name too long" });

    expect(screen.getByRole("alert")).toHaveTextContent("Could not save the plan: Name too long");
  });

  it("does not modify the plan it was given", () => {
    const plan: PlanRead = structuredClone(mockPlans[0]);
    const snapshot = structuredClone(plan);
    renderEditor({ initialPlan: plan });

    fireEvent.click(screen.getByRole("button", { name: "Add Set" }));
    fireEvent.change(screen.getByLabelText("Day Label"), { target: { value: "Changed" } });
    fireEvent.click(screen.getByRole("button", { name: "Remove Exercise: Bench Press" }));

    expect(plan).toEqual(snapshot);
  });

  it("wraps a very long exercise name and day label instead of overflowing", () => {
    const longExercise = "Schrägbankdrücken".repeat(10);
    const plan = structuredClone(mockPlans[0]);
    const longDay = "Brust".repeat(60);
    plan.days[0].label = longDay;
    const long = [{ ...exercises[0], name: longExercise }];
    renderEditor({ initialPlan: plan, availableExercises: long });

    expect(screen.getByRole("heading", { name: longExercise })).toHaveClass("break-words");
    const tab = screen.getByRole("button", { name: longDay });
    expect(tab).toHaveClass("truncate", "max-w-[12rem]");
    expect(tab).toHaveAttribute("title", longDay);
  });
});
