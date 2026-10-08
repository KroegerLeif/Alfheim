import { screen, waitFor, fireEvent } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { describe, it, expect, beforeEach } from "vitest";
import { server } from "@/tests/mocks/server";
import { routerMock } from "@/tests/mocks/router";
import { renderWithProviders } from "@/tests/test-utils";
import { PlanDetailView } from "../components/PlanDetailView";

describe("PlanDetailView", () => {
  beforeEach(() => {
    localStorage.setItem("alfheim_active_household_id", "hh-1");
  });

  it("loads the plan into the editor", async () => {
    renderWithProviders(<PlanDetailView planId="plan-1" />);

    expect(await screen.findByDisplayValue("Push Pull Legs")).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 1, name: "Edit Plan" })).toBeInTheDocument();
  });

  it("saves and returns to the plan list", async () => {
    renderWithProviders(<PlanDetailView planId="plan-1" />);

    await screen.findByDisplayValue("Push Pull Legs");
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => expect(routerMock.push).toHaveBeenCalledWith("/plans"));
  });

  it("shows why saving failed and stays on the page", async () => {
    server.use(
      http.patch(/\/plans\/([^/]+)$/, () =>
        HttpResponse.json(
          { detail: { code: "household_role_forbidden", message: "Only the owner can edit this plan" } },
          { status: 403 }
        )
      )
    );
    renderWithProviders(<PlanDetailView planId="plan-1" />);

    await screen.findByDisplayValue("Push Pull Legs");
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("Could not save the plan");
    expect(alert).toHaveTextContent("Only the owner can edit this plan");
    expect(routerMock.push).not.toHaveBeenCalled();
  });

  it("asks for confirmation before deleting and leaves after the delete succeeded", async () => {
    renderWithProviders(<PlanDetailView planId="plan-1" />);

    await screen.findByDisplayValue("Push Pull Legs");
    fireEvent.click(screen.getByRole("button", { name: "Delete Plan" }));

    const dialog = await screen.findByRole("dialog");
    expect(dialog).toHaveTextContent('Really delete plan "Push Pull Legs"?');
    expect(routerMock.push).not.toHaveBeenCalled();

    const confirm = Array.from(dialog.querySelectorAll("button")).find((b) => b.textContent === "Delete Plan");
    fireEvent.click(confirm as HTMLButtonElement);

    await waitFor(() => expect(routerMock.push).toHaveBeenCalledWith("/plans"));
  });

  it("shows why deleting failed and closes the dialog", async () => {
    server.use(
      http.delete(/\/plans\/([^/]+)$/, () => HttpResponse.json({ detail: "Plan is in use" }, { status: 409 }))
    );
    renderWithProviders(<PlanDetailView planId="plan-1" />);

    await screen.findByDisplayValue("Push Pull Legs");
    fireEvent.click(screen.getByRole("button", { name: "Delete Plan" }));
    const dialog = await screen.findByRole("dialog");
    const confirm = Array.from(dialog.querySelectorAll("button")).find((b) => b.textContent === "Delete Plan");
    fireEvent.click(confirm as HTMLButtonElement);

    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("Could not delete the plan");
    expect(alert).toHaveTextContent("Plan is in use");
    expect(routerMock.push).not.toHaveBeenCalled();
  });

  it("offers a way back when the plan cannot be loaded", async () => {
    server.use(http.get(/\/plans\/([^/]+)$/, () => HttpResponse.json({ detail: "gone" }, { status: 404 })));
    renderWithProviders(<PlanDetailView planId="missing" />);

    expect(await screen.findByText("Failed to load data")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Workout Plans" })).toHaveAttribute("href", "/plans");
  });

  it("wraps a very long plan name in the heading area", async () => {
    const longName = "Ganzkörperplan".repeat(15);
    server.use(
      http.get(/\/plans\/([^/]+)$/, () =>
        HttpResponse.json({ ...(mockPlan()), name: longName })
      )
    );
    renderWithProviders(<PlanDetailView planId="plan-1" />);

    await screen.findByDisplayValue(longName);
    const subtitle = screen.getByText(longName, { selector: "p" });
    expect(subtitle).toHaveClass("break-words");
  });
});

function mockPlan() {
  return {
    id: "plan-1",
    home_id: "hh-1",
    owner_user_id: "user-1",
    name: "x",
    description: null,
    is_shared: false,
    is_active: true,
    created_at: "2026-08-01T10:00:00Z",
    updated_at: "2026-08-01T10:00:00Z",
    days: [{ id: "day-1", day_order: 1, label: "Push Day", exercises: [] }],
  };
}
