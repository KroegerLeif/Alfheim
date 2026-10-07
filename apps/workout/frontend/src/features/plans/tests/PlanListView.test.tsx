import { screen, waitFor, fireEvent } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { describe, it, expect, beforeEach } from "vitest";
import { server } from "@/tests/mocks/server";
import { routerMock } from "@/tests/mocks/router";
import { renderWithProviders } from "@/tests/test-utils";
import { PlanListView } from "../components/PlanListView";

describe("PlanListView", () => {
  beforeEach(() => {
    localStorage.setItem("alfheim_active_household_id", "hh-1");
  });

  it("renders page header and plans list once loaded", async () => {
    renderWithProviders(<PlanListView />);

    expect(screen.getByRole("heading", { name: "Workout Plans" })).toBeInTheDocument();
    expect(screen.getByText("Create and manage multi-day split routines")).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText("Push Pull Legs")).toBeInTheDocument();
    });
  });

  it("opens PlanEditor when Create Plan is clicked", async () => {
    renderWithProviders(<PlanListView />);

    await screen.findByText("Push Pull Legs");

    const createButtons = screen.getAllByText("Create Plan");
    fireEvent.click(createButtons[0]);

    expect(screen.getByPlaceholderText("e.g. Push Pull Legs")).toBeInTheDocument();
  });

  it("starts a session from a plan day and opens the live session", async () => {
    renderWithProviders(<PlanListView />);

    fireEvent.click(await screen.findByRole("button", { name: "Start Push Day" }));

    await waitFor(() => expect(routerMock.push).toHaveBeenCalledWith("/session/sess-1"));
  });

  it("shows the server's reason when starting a session fails", async () => {
    server.use(
      http.post(/\/sessions$/, () => HttpResponse.json({ detail: "Plan day not found." }, { status: 400 }))
    );
    renderWithProviders(<PlanListView />);

    fireEvent.click(await screen.findByRole("button", { name: "Start Push Day" }));

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("Could not start the session");
    expect(alert).toHaveTextContent("Plan day not found.");
    expect(routerMock.push).not.toHaveBeenCalled();
  });

  it("shows a localized message when the network is down while starting", async () => {
    server.use(http.post(/\/sessions$/, () => HttpResponse.error()));
    renderWithProviders(<PlanListView />, { language: "de" });

    fireEvent.click(await screen.findByRole("button", { name: "Push Day starten" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Einheit konnte nicht gestartet werden");
  });

  it("keeps the editor open and explains why when creating a plan fails", async () => {
    server.use(
      http.post(/\/plans$/, () =>
        HttpResponse.json({ detail: { code: "validation_failed", message: "Name too long" } }, { status: 400 })
      )
    );
    renderWithProviders(<PlanListView />);

    await screen.findByText("Push Pull Legs");
    fireEvent.click(screen.getAllByText("Create Plan")[0]);
    fireEvent.change(screen.getByPlaceholderText("e.g. Push Pull Legs"), { target: { value: "Fresh Plan" } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("Could not save the plan");
    expect(alert).toHaveTextContent("Name too long");
    expect(screen.getByPlaceholderText("e.g. Push Pull Legs")).toHaveValue("Fresh Plan");
  });

  it("closes the editor after a plan was created", async () => {
    renderWithProviders(<PlanListView />);

    await screen.findByText("Push Pull Legs");
    fireEvent.click(screen.getAllByText("Create Plan")[0]);
    fireEvent.change(screen.getByPlaceholderText("e.g. Push Pull Legs"), { target: { value: "Fresh Plan" } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => expect(screen.queryByPlaceholderText("e.g. Push Pull Legs")).not.toBeInTheDocument());
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("shows the empty state when there are no plans", async () => {
    server.use(http.get(/\/plans$/, () => HttpResponse.json([])));
    renderWithProviders(<PlanListView />);

    expect(await screen.findByText("No plans yet")).toBeInTheDocument();
  });

  it("shows a load error banner when the plans request fails", async () => {
    server.use(http.get(/\/plans$/, () => HttpResponse.json({ detail: "boom" }, { status: 500 })));
    renderWithProviders(<PlanListView />);

    expect(await screen.findByRole("alert")).toHaveTextContent("Failed to load data");
  });
});
