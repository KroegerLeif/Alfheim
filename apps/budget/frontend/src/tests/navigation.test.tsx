import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { vi } from "vitest";
import { MobileTabBar, DesktopSidebar } from "../features/navigation";

describe("MobileTabBar Component", () => {
  it("renders exactly 4 bottom tabs", () => {
    render(<MobileTabBar />);

    expect(screen.getByText("Dashboard")).toBeInTheDocument();
    expect(screen.getByText("Planning")).toBeInTheDocument();
    expect(screen.getByText("Pots")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Quick-Add Transaction" })
    ).toBeInTheDocument();
  });

  it("triggers Quick-Add callback on button click", () => {
    const handleQuickAdd = vi.fn();
    render(<MobileTabBar onQuickAdd={handleQuickAdd} />);

    fireEvent.click(screen.getByRole("button", { name: "Quick-Add Transaction" }));
    expect(handleQuickAdd).toHaveBeenCalledTimes(1);
  });

  it("handles planning mode change (Monat / Event)", () => {
    const handlePlanningModeChange = vi.fn();
    render(
      <MobileTabBar
        activeTab="planning"
        planningMode="monthly"
        onPlanningModeChange={handlePlanningModeChange}
      />
    );

    const eventBtn = screen.getByRole("button", { name: "Event" });
    fireEvent.click(eventBtn);
    expect(handlePlanningModeChange).toHaveBeenCalledWith("event");

    const monatBtn = screen.getByRole("button", { name: "Monat" });
    fireEvent.click(monatBtn);
    expect(handlePlanningModeChange).toHaveBeenCalledWith("monthly");
  });
});

describe("DesktopSidebar Component", () => {
  it("renders all expected desktop navigation items and Quick-Add button", () => {
    render(<DesktopSidebar currentPath="/" />);

    expect(screen.getByText("Budget & Treasury")).toBeInTheDocument();
    expect(screen.getByText("Dashboard")).toBeInTheDocument();
    expect(screen.getByText("Planning")).toBeInTheDocument();
    expect(screen.getByText("Pots")).toBeInTheDocument();
    expect(screen.getByText("Sankey Cashflow")).toBeInTheDocument();
    expect(screen.getByText("Net-Worth Analytics")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Quick-Add Transaction" })
    ).toBeInTheDocument();
  });

  it("triggers Quick-Add callback when clicked", () => {
    const handleQuickAdd = vi.fn();
    render(<DesktopSidebar onQuickAdd={handleQuickAdd} />);

    fireEvent.click(screen.getByRole("button", { name: "Quick-Add Transaction" }));
    expect(handleQuickAdd).toHaveBeenCalledTimes(1);
  });

  it("renders segmented control for Planning when active", () => {
    const handleModeChange = vi.fn();
    render(
      <DesktopSidebar
        currentPath="/planning"
        planningMode="monthly"
        onPlanningModeChange={handleModeChange}
      />
    );

    const eventBtn = screen.getByRole("button", { name: "Event" });
    fireEvent.click(eventBtn);
    expect(handleModeChange).toHaveBeenCalledWith("event");
  });
});
