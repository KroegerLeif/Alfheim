import { screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { axe } from "vitest-axe";
import { renderWithI18n } from "@/tests/test-utils";
import { ActiveSetPanel } from "../components/ActiveSetPanel";
import { RestTimerPanel } from "../components/RestTimerPanel";
import { SessionProgressList } from "../components/SessionProgressList";
import { SetStepper } from "../components/SetStepper";
import { makeExercise, makeSet } from "./fixtures";

describe("SetStepper", () => {
  function renderStepper(value: number, onChange = vi.fn(), min?: number) {
    renderWithI18n(
      <SetStepper
        label="Weight"
        value={value}
        onChange={onChange}
        step={2.5}
        min={min}
        suffix="kg"
        decrementLabel="Weight -2.5"
        incrementLabel="Weight +2.5"
      />
    );
    return onChange;
  }

  it("steps up and down by the configured amount", () => {
    const onChange = renderStepper(60);

    fireEvent.click(screen.getByRole("button", { name: "Weight +2.5" }));
    fireEvent.click(screen.getByRole("button", { name: "Weight -2.5" }));

    expect(onChange).toHaveBeenNthCalledWith(1, 62.5);
    expect(onChange).toHaveBeenNthCalledWith(2, 57.5);
  });

  it("never goes below the minimum", () => {
    const onChange = renderStepper(1, vi.fn());

    fireEvent.click(screen.getByRole("button", { name: "Weight -2.5" }));

    expect(onChange).toHaveBeenCalledWith(0);
  });

  it("accepts a typed value and clamps invalid input to the minimum", () => {
    const onChange = renderStepper(60);

    fireEvent.change(screen.getByLabelText("Weight"), { target: { value: "72.5" } });
    fireEvent.change(screen.getByLabelText("Weight"), { target: { value: "-4" } });

    expect(onChange).toHaveBeenNthCalledWith(1, 72.5);
    expect(onChange).toHaveBeenNthCalledWith(2, 0);
  });

  it("shows the unit next to the value", () => {
    renderStepper(60);
    expect(screen.getByText("kg")).toBeInTheDocument();
  });
});

describe("ActiveSetPanel", () => {
  const exercise = makeExercise("ex-1", "Bench Press", []);

  it("logs the targets unchanged with one tap", () => {
    const onLog = vi.fn();
    renderWithI18n(
      <ActiveSetPanel
        exercise={exercise}
        set={makeSet({ id: "s", set_order: 1, target_reps: 5, target_weight_kg: 80 })}
        setIndex={0}
        onLog={onLog}
        isLogging={false}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "Log Set" }));

    expect(onLog).toHaveBeenCalledWith(5, 80);
  });

  it("falls back to zero and warns when no target weight is known", () => {
    const onLog = vi.fn();
    renderWithI18n(
      <ActiveSetPanel
        exercise={exercise}
        set={makeSet({ id: "s", set_order: 1, target_reps: null, target_weight_kg: null })}
        setIndex={2}
        onLog={onLog}
        isLogging={false}
      />
    );

    expect(screen.getByText("No default weight set")).toBeInTheDocument();
    expect(screen.getByText("Set 3")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Log Set" }));
    expect(onLog).toHaveBeenCalledWith(0, 0);
  });

  it("marks warm-up sets and blocks double taps while logging", () => {
    renderWithI18n(
      <ActiveSetPanel
        exercise={exercise}
        set={makeSet({ id: "s", set_order: 1, is_warmup: true })}
        setIndex={0}
        onLog={vi.fn()}
        isLogging
      />
    );

    expect(screen.getByText("Warm-up Set")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Log Set" })).toBeDisabled();
  });

  it("passes the accessibility audit", async () => {
    const { container } = renderWithI18n(
      <ActiveSetPanel exercise={exercise} set={makeSet({ id: "s", set_order: 1 })} setIndex={0} onLog={vi.fn()} isLogging={false} />
    );
    expect(await axe(container)).toHaveNoViolations();
  });
});

describe("RestTimerPanel", () => {
  it("renders nothing without a running rest period", () => {
    const { container } = renderWithI18n(<RestTimerPanel secondsRemaining={null} onSkip={vi.fn()} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("shows the countdown and lets the user skip it", () => {
    const onSkip = vi.fn();
    renderWithI18n(<RestTimerPanel secondsRemaining={75} onSkip={onSkip} />);

    expect(screen.getByRole("timer")).toHaveTextContent("1:15");
    fireEvent.click(screen.getByRole("button", { name: "Skip Rest" }));
    expect(onSkip).toHaveBeenCalled();
  });
});

describe("SessionProgressList", () => {
  const done = "2026-08-16T09:10:00Z";

  it("renders nothing for an empty or missing list", () => {
    const { container } = renderWithI18n(<SessionProgressList exercises={null as never} activeExerciseId={null} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("shows completed counts and highlights the active exercise", () => {
    const exercises = [
      makeExercise("a", "Bench Press", [makeSet({ id: "1", set_order: 1, completed_at: done }), makeSet({ id: "2", set_order: 2 })]),
      makeExercise("b", "Squat", [makeSet({ id: "3", set_order: 1 })], 2),
      makeExercise("c", "Row", [makeSet({ id: "4", set_order: 1, completed_at: done })], 3),
    ];
    renderWithI18n(<SessionProgressList exercises={exercises} activeExerciseId="a" />);

    expect(screen.getByText("1/2")).toBeInTheDocument();
    expect(screen.getByText("0/1")).toBeInTheDocument();
    expect(screen.getByText("1/1")).toBeInTheDocument();
    const items = screen.getAllByRole("listitem");
    expect(items[0]).toHaveAttribute("aria-current", "step");
    expect(items[1]).not.toHaveAttribute("aria-current");
    expect(screen.getByText("Exercise 1 of 3")).toBeInTheDocument();
  });

  it("truncates very long exercise names without pushing the counter out", () => {
    const longName = "Einarmiges Kurzhantelrudern".repeat(8);
    renderWithI18n(
      <SessionProgressList exercises={[makeExercise("a", longName, [makeSet({ id: "1", set_order: 1 })])]} activeExerciseId="a" />
    );

    const name = screen.getByText(longName);
    expect(name).toHaveClass("truncate");
    expect(name.parentElement).toHaveClass("min-w-0");
    expect(screen.getByText("0/1")).toBeInTheDocument();
  });
});
