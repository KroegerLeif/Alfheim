import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { mockPlans } from "@/tests/mocks/handlers";
import { PlanCard } from "../components/PlanCard";

describe("PlanCard", () => {
  it("renders plan title, description, and days preview", () => {
    render(<PlanCard plan={mockPlans[0]} />);

    expect(screen.getByText("Push Pull Legs")).toBeInTheDocument();
    expect(screen.getByText("A 3-day split focused on compound lifts.")).toBeInTheDocument();
    expect(screen.getByText(/Push Day/)).toBeInTheDocument();
  });

  it("calls onStartSession when Start Session button is clicked", () => {
    const handleStart = vi.fn();
    render(<PlanCard plan={mockPlans[0]} onStartSession={handleStart} />);

    const startBtn = screen.getByText("startSession");
    fireEvent.click(startBtn);

    expect(handleStart).toHaveBeenCalledWith("plan-1", "day-1");
  });
});
