import { screen, waitFor, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { describe, it, expect, beforeEach, vi } from "vitest";
import { mockExercises } from "@/tests/mocks/handlers";
import { server } from "@/tests/mocks/server";
import { renderWithI18n, renderWithProviders } from "@/tests/test-utils";
import { ExerciseBaselineDialog } from "../components/ExerciseBaselineDialog";
import { ExerciseCard } from "../components/ExerciseCard";
import { ExerciseCreateForm } from "../components/ExerciseCreateForm";
import { ExerciseListView } from "../components/ExerciseListView";
import type { ExerciseRead } from "../types";

const bench = mockExercises[0] as unknown as ExerciseRead;
const squat = mockExercises[1] as unknown as ExerciseRead;

beforeEach(() => {
  localStorage.clear();
  localStorage.setItem("alfheim_active_household_id", "hh-1");
});

describe("ExerciseListView failures", () => {
  it("explains why deleting an exercise failed", async () => {
    server.use(
      http.delete(/\/exercises\/([^/]+)$/, () => HttpResponse.json({ detail: "Exercise is used by a plan" }, { status: 409 }))
    );
    const user = userEvent.setup();
    renderWithProviders(<ExerciseListView />);

    await user.click(await screen.findByRole("button", { name: "Delete Bench Press" }));

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("Could not delete the entry");
    expect(alert).toHaveTextContent("Exercise is used by a plan");
  });

  it("explains why toggling a favorite failed", async () => {
    server.use(http.delete(/\/exercises\/([^/]+)\/favorite$/, () => HttpResponse.json({ detail: "nope" }, { status: 500 })));
    const user = userEvent.setup();
    renderWithProviders(<ExerciseListView />);

    await user.click((await screen.findAllByRole("button", { name: "Remove from Favorites" }))[0]);

    expect(await screen.findByRole("alert")).toHaveTextContent("Save failed");
  });

  it("shows the empty state and the load error", async () => {
    server.use(http.get(/\/exercises$/, () => HttpResponse.json({ detail: "boom" }, { status: 500 })));
    renderWithProviders(<ExerciseListView />);

    expect(await screen.findByRole("alert")).toHaveTextContent("Failed to load data");
    expect(await screen.findByText("No exercises found")).toBeInTheDocument();
  });
});

describe("ExerciseCard", () => {
  const handlers = {
    onToggleFavorite: vi.fn(),
    onSetBaseline: vi.fn(),
    onDelete: vi.fn(),
  };

  it("offers delete only for exercises the user may edit", () => {
    const { rerender } = renderWithI18n(<ExerciseCard exercise={bench} isFavorite={false} {...handlers} />);
    expect(screen.getByRole("button", { name: "Delete Bench Press" })).toBeInTheDocument();

    rerender(<ExerciseCard exercise={squat} isFavorite={false} {...handlers} />);
    expect(screen.queryByRole("button", { name: /^Delete/ })).not.toBeInTheDocument();
  });

  it("keeps long names readable and the action buttons in place", () => {
    const longName = "Langhantel-Kreuzheben".repeat(8);
    renderWithI18n(<ExerciseCard exercise={{ ...bench, name: longName }} isFavorite {...handlers} />);

    const title = screen.getByRole("heading", { name: longName });
    expect(title).toHaveClass("break-words", "line-clamp-2");
    expect(title.parentElement).toHaveClass("min-w-0");
    expect(screen.getByRole("button", { name: "Remove from Favorites" }).parentElement).toHaveClass("shrink-0");
  });

  it("reports the card actions", () => {
    renderWithI18n(<ExerciseCard exercise={bench} isFavorite={false} {...handlers} />);

    fireEvent.click(screen.getByRole("button", { name: "Add to Favorites" }));
    fireEvent.click(screen.getByRole("button", { name: "Set Default Weight Bench Press" }));
    fireEvent.click(screen.getByRole("button", { name: "Delete Bench Press" }));

    expect(handlers.onToggleFavorite).toHaveBeenCalledWith(bench);
    expect(handlers.onSetBaseline).toHaveBeenCalledWith(bench);
    expect(handlers.onDelete).toHaveBeenCalledWith(bench);
  });
});

describe("ExerciseCreateForm", () => {
  it("requires a name", async () => {
    const user = userEvent.setup();
    renderWithProviders(<ExerciseCreateForm onSuccess={vi.fn()} onCancel={vi.fn()} />);

    fireEvent.submit(screen.getByRole("button", { name: "Create" }).closest("form") as HTMLFormElement);

    expect(await screen.findByRole("alert")).toHaveTextContent("Exercise name is required");
    await user.type(screen.getByLabelText(/Exercise Name/), "x");
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("creates the exercise and reports success", async () => {
    const onSuccess = vi.fn();
    const user = userEvent.setup();
    renderWithProviders(<ExerciseCreateForm onSuccess={onSuccess} onCancel={vi.fn()} />);

    await user.type(screen.getByLabelText(/Exercise Name/), "Dips");
    await user.selectOptions(screen.getByLabelText("Primary Muscle"), "triceps");
    await user.click(screen.getByRole("button", { name: "Create" }));

    await waitFor(() => expect(onSuccess).toHaveBeenCalled());
  });

  it("shows the server's reason when creating fails", async () => {
    server.use(http.post(/\/exercises$/, () => HttpResponse.json({ detail: "Name already exists" }, { status: 400 })));
    const user = userEvent.setup();
    renderWithProviders(<ExerciseCreateForm onSuccess={vi.fn()} onCancel={vi.fn()} />);

    await user.type(screen.getByLabelText(/Exercise Name/), "Dips");
    await user.click(screen.getByRole("button", { name: "Create" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Save failed: Name already exists");
  });
});

describe("ExerciseBaselineDialog", () => {
  it("loads the current default weight and saves a new one", async () => {
    const onOpenChange = vi.fn();
    const user = userEvent.setup();
    renderWithProviders(<ExerciseBaselineDialog exercise={bench} open onOpenChange={onOpenChange} />);

    const input = await screen.findByLabelText("Default Weight");
    await waitFor(() => expect(input).toHaveValue(60));
    await user.clear(input);
    await user.type(input, "62.5");
    await user.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
  });

  it("shows why saving failed", async () => {
    server.use(http.put(/\/exercises\/([^/]+)\/preference$/, () => HttpResponse.json({ detail: "Weight out of range" }, { status: 400 })));
    const user = userEvent.setup();
    renderWithProviders(<ExerciseBaselineDialog exercise={bench} open onOpenChange={vi.fn()} />);

    await screen.findByLabelText("Default Weight");
    await user.click(screen.getByRole("button", { name: "Save" }));

    expect(await screen.findByText("Save failed: Weight out of range")).toBeInTheDocument();
  });

  it("is translated", async () => {
    renderWithProviders(<ExerciseBaselineDialog exercise={bench} open onOpenChange={vi.fn()} />, { language: "pl" });

    expect(await screen.findByLabelText("Domyślny Ciężar")).toBeInTheDocument();
  });
});
