import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, beforeEach } from "vitest";
import { axe } from "vitest-axe";
import { renderWithProviders } from "@/tests/test-utils";
import { ExerciseListView } from "../components/ExerciseListView";

describe("ExerciseListView", () => {
  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem("alfheim_active_household_id", "hh-1");
  });

  it("renders the exercise list once data loads", async () => {
    renderWithProviders(<ExerciseListView />);

    expect(await screen.findByText("Bench Press")).toBeInTheDocument();
    expect(screen.getByText("Squat")).toBeInTheDocument();
  });

  it("passes accessibility audit once loaded", async () => {
    const { container } = renderWithProviders(<ExerciseListView />);

    await screen.findByText("Bench Press");

    expect(await axe(container)).toHaveNoViolations();
  });

  it("toggles the create-exercise form open and closed", async () => {
    const user = userEvent.setup();
    renderWithProviders(<ExerciseListView />);

    await screen.findByText("Bench Press");

    await user.click(screen.getByRole("button", { name: "createExercise" }));
    expect(screen.getByRole("button", { name: "create" })).toBeInTheDocument();

    // Both the toggle button and the form's own button read "cancel" while
    // the form is open; the form's cancel button is the last one rendered.
    const cancelButtons = screen.getAllByRole("button", { name: "cancel" });
    await user.click(cancelButtons[cancelButtons.length - 1]);
    expect(screen.queryByRole("button", { name: "create" })).not.toBeInTheDocument();
  });

  it("filters by primary muscle group", async () => {
    const user = userEvent.setup();
    renderWithProviders(<ExerciseListView />);

    await screen.findByText("Bench Press");

    const filter = screen.getByRole("combobox", { name: "primaryMuscle" });
    await user.selectOptions(filter, "quads");

    await waitFor(() => expect(screen.queryByText("Bench Press")).not.toBeInTheDocument());
    expect(screen.getByText("Squat")).toBeInTheDocument();
  });

  it("toggles a favorite from the card", async () => {
    const user = userEvent.setup();
    renderWithProviders(<ExerciseListView />);

    await screen.findByText("Bench Press");

    // "Bench Press" (ex-1) starts favorited per the mock data; toggling calls
    // the remove-favorite mutation and should not throw.
    const favoriteButtons = screen.getAllByRole("button", { name: /favorite/i });
    await user.click(favoriteButtons[0]);

    await waitFor(() => expect(favoriteButtons[0]).not.toBeDisabled());
  });
});
