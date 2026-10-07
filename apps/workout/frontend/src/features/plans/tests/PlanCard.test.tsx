import { screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { mockPlans } from "@/tests/mocks/handlers";
import { renderWithI18n } from "@/tests/test-utils";
import { PlanCard } from "../components/PlanCard";
import type { PlanDayRead, PlanRead } from "../types";

function day(id: string, order: number, label: string, exerciseCount = 1): PlanDayRead {
  return {
    id,
    day_order: order,
    label,
    exercises: Array.from({ length: exerciseCount }, (_, index) => ({
      id: `${id}-ex-${index}`,
      exercise_id: "ex-1",
      exercise_order: index + 1,
      sets: [],
    })),
  };
}

const splitPlan: PlanRead = {
  ...mockPlans[0],
  id: "plan-split",
  name: "Upper Lower",
  days: [day("day-a", 1, "Push"), day("day-b", 2, "Pull", 3), day("day-c", 3, "Legs", 2)],
};

describe("PlanCard", () => {
  it("renders plan title, description, and days preview", () => {
    renderWithI18n(<PlanCard plan={mockPlans[0]} />);

    expect(screen.getByText("Push Pull Legs")).toBeInTheDocument();
    expect(screen.getByText("A 3-day split focused on compound lifts.")).toBeInTheDocument();
    expect(screen.getByText("Push Day")).toBeInTheDocument();
  });

  it("starts a session from the clicked day", () => {
    const handleStart = vi.fn();
    renderWithI18n(<PlanCard plan={mockPlans[0]} onStartSession={handleStart} />);

    fireEvent.click(screen.getByRole("button", { name: "Start Push Day" }));

    expect(handleStart).toHaveBeenCalledWith("plan-1", "day-1");
  });

  it("offers one start button per day so days after the first are reachable", () => {
    const handleStart = vi.fn();
    renderWithI18n(<PlanCard plan={splitPlan} onStartSession={handleStart} />);

    expect(screen.getAllByRole("button", { name: /^Start / })).toHaveLength(3);

    fireEvent.click(screen.getByRole("button", { name: "Start Pull" }));
    expect(handleStart).toHaveBeenLastCalledWith("plan-split", "day-b");

    fireEvent.click(screen.getByRole("button", { name: "Start Legs" }));
    expect(handleStart).toHaveBeenLastCalledWith("plan-split", "day-c");
  });

  it("disables every start button while a session is starting", () => {
    renderWithI18n(<PlanCard plan={splitPlan} onStartSession={vi.fn()} isStarting />);

    for (const button of screen.getAllByRole("button", { name: /^Start / })) {
      expect(button).toBeDisabled();
    }
  });

  it("hides the start buttons when no start handler is given", () => {
    renderWithI18n(<PlanCard plan={splitPlan} />);

    expect(screen.queryByRole("button", { name: /^Start / })).not.toBeInTheDocument();
  });

  it("shows a placeholder for a plan without days", () => {
    renderWithI18n(<PlanCard plan={{ ...mockPlans[0], days: [] }} onStartSession={vi.fn()} />);

    expect(screen.getByText("This plan has no days yet")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^Start / })).not.toBeInTheDocument();
  });

  it.each([
    ["en", "Day 2"],
    ["de", "Tag 2"],
    ["pl", "Dzień 2"],
  ] as const)("names a day with a blank label in the %s locale", (language, expected) => {
    const plan = { ...splitPlan, days: [day("day-a", 1, "Push"), day("day-b", 2, "  ")] };
    renderWithI18n(<PlanCard plan={plan} onStartSession={vi.fn()} />, language);

    expect(screen.getByText(expected)).toBeInTheDocument();
  });

  it("renders very long names, descriptions and day labels without unbreakable overflow", () => {
    const longName = "Hypertrophie".repeat(20);
    const longLabel = "Oberkörper-Schwerpunkt".repeat(10);
    const longDescription = "Aufbauphase".repeat(40);
    const plan: PlanRead = {
      ...splitPlan,
      name: longName,
      description: longDescription,
      days: [day("day-long", 1, longLabel)],
    };
    renderWithI18n(<PlanCard plan={plan} onStartSession={vi.fn()} />);

    const title = screen.getByText(longName);
    expect(title).toHaveClass("break-words");
    expect(title.parentElement).toHaveClass("min-w-0");

    expect(screen.getByText(longDescription)).toHaveClass("line-clamp-2", "break-words");

    const label = screen.getByText(longLabel);
    expect(label).toHaveClass("truncate");
    expect(label).toHaveAttribute("title", longLabel);
    // The start button must stay reachable next to the truncated label.
    expect(screen.getByRole("button", { name: `Start ${longLabel}` })).toHaveClass("shrink-0");
  });
});
