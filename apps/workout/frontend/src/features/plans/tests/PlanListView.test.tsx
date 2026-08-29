import { screen, waitFor, fireEvent } from "@testing-library/react";
import { describe, it, expect, beforeEach } from "vitest";
import { renderWithProviders } from "@/tests/test-utils";
import { PlanListView } from "../components/PlanListView";

describe("PlanListView", () => {
  beforeEach(() => {
    localStorage.setItem("alfheim_active_household_id", "hh-1");
  });

  it("renders page header and plans list once loaded", async () => {
    renderWithProviders(<PlanListView />);

    expect(screen.getByText("plansTitle")).toBeInTheDocument();
    expect(screen.getByText("plansSubtitle")).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText("Push Pull Legs")).toBeInTheDocument();
    });
  });

  it("opens PlanEditor when Create Plan is clicked", async () => {
    renderWithProviders(<PlanListView />);

    await waitFor(() => {
      expect(screen.getByText("Push Pull Legs")).toBeInTheDocument();
    });

    const createButtons = screen.getAllByText("createPlan");
    fireEvent.click(createButtons[0]);

    expect(screen.getByPlaceholderText("planNamePlaceholder")).toBeInTheDocument();
  });
});
