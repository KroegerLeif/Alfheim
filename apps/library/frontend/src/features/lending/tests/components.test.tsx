import { describe, it, expect, vi } from "vitest";
import { screen, fireEvent, waitFor } from "@testing-library/react";
import { renderWithProviders } from "@/tests/renderWithProviders";
import { ActiveLoansList } from "../components/ActiveLoansList";
import { LendItemDialog } from "../components/LendItemDialog";
import { LendingHistoryTable } from "../components/LendingHistoryTable";
import { makeRecord } from "./fixtures";

const LONG_WORD = "Supercalifragilisticexpialidocious".repeat(6);

describe("ActiveLoansList", () => {
  it("shows the item title instead of the raw item id (issue #549)", () => {
    const record = makeRecord();
    renderWithProviders(<ActiveLoansList loans={[record]} onReturnItem={vi.fn()} />);

    expect(screen.getByRole("heading", { name: "Dune" })).toBeInTheDocument();
    expect(screen.queryByText(record.item_id)).toBeNull();
  });

  it("falls back to a localized label when the title is unknown", () => {
    renderWithProviders(
      <ActiveLoansList loans={[makeRecord({ item_title: null })]} onReturnItem={vi.fn()} />,
      { language: "de" }
    );
    expect(screen.getByRole("heading", { name: "Unbekanntes Medium" })).toBeInTheDocument();
  });

  it("keeps very long titles, names and notes inside the card", () => {
    renderWithProviders(
      <ActiveLoansList
        loans={[makeRecord({ item_title: LONG_WORD, contact_name: LONG_WORD, notes: LONG_WORD })]}
        onReturnItem={vi.fn()}
      />
    );

    expect(screen.getByRole("heading", { name: LONG_WORD })).toHaveClass("min-w-0", "break-words", "line-clamp-2");
    const [, contact] = screen.getAllByText(LONG_WORD);
    expect(contact).toHaveClass("min-w-0", "break-words");
    expect(screen.getByText(`"${LONG_WORD}"`)).toHaveClass("break-words", "line-clamp-2");
    expect(screen.getByText("Lent Out")).toHaveClass("shrink-0");
  });

  it("marks past-due loans as overdue and returns the loan", () => {
    const onReturnItem = vi.fn();
    const record = makeRecord({ due_date: "2020-01-01T00:00:00Z" });
    renderWithProviders(<ActiveLoansList loans={[record]} onReturnItem={onReturnItem} />);

    expect(screen.getByText("Overdue")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Mark as Returned" }));
    expect(onReturnItem).toHaveBeenCalledWith(record);
  });

  it("formats dates with the active language", () => {
    renderWithProviders(
      <ActiveLoansList
        loans={[makeRecord({ lent_at: "2025-03-21T12:00:00Z" })]}
        onReturnItem={vi.fn()}
      />,
      { language: "de" }
    );
    expect(screen.getByText(/Ausgeliehen am: 21\.3\.2025/)).toBeInTheDocument();
  });

  it("renders loading, empty and error states", () => {
    const { container, rerender } = renderWithProviders(
      <ActiveLoansList loans={[]} isLoading onReturnItem={vi.fn()} />
    );
    expect(container.querySelectorAll(".animate-pulse")).toHaveLength(3);

    rerender(<ActiveLoansList loans={[]} onReturnItem={vi.fn()} />);
    expect(screen.getByText("No items currently lent out.")).toBeInTheDocument();

    rerender(<ActiveLoansList loans={[]} isError onReturnItem={vi.fn()} />);
    expect(screen.getByRole("alert")).toHaveTextContent("Failed to load lending history");
  });
});

describe("LendingHistoryTable", () => {
  it("lists item titles and localized status for every record", () => {
    renderWithProviders(
      <LendingHistoryTable
        history={[
          makeRecord(),
          makeRecord({ id: "rec-2", item_title: "Emma", status: "AVAILABLE", returned_at: "2025-03-05T00:00:00Z" }),
        ]}
      />
    );

    expect(screen.getByRole("columnheader", { name: "Status" })).toBeInTheDocument();
    expect(screen.getByText("Dune")).toBeInTheDocument();
    expect(screen.getByText("Emma")).toBeInTheDocument();
    expect(screen.getByText("Lent Out")).toBeInTheDocument();
    expect(screen.getByText("Available")).toBeInTheDocument();
  });

  it("wraps long titles and truncates long notes", () => {
    renderWithProviders(
      <LendingHistoryTable
        history={[makeRecord({ item_title: LONG_WORD, contact_name: LONG_WORD, notes: LONG_WORD })]}
      />
    );

    const cells = screen.getAllByText(LONG_WORD);
    expect(cells[0]).toHaveClass("break-words", "max-w-[16rem]");
    expect(cells[1]).toHaveClass("break-words", "max-w-[12rem]");
    expect(cells[2]).toHaveClass("truncate");
    expect(cells[2]).toHaveAttribute("title", LONG_WORD);
  });

  it("uses a dedicated empty message and localized error state", () => {
    const { rerender } = renderWithProviders(<LendingHistoryTable history={[]} />, { language: "pl" });
    expect(screen.getByText("Brak historii wypożyczeń.")).toBeInTheDocument();

    rerender(<LendingHistoryTable history={[]} isError />);
    expect(screen.getByRole("alert")).toHaveTextContent("Nie udało się załadować historii wypożyczeń");
  });
});

describe("LendItemDialog", () => {
  it("submits a trimmed payload and clears the form", async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    const onOpenChange = vi.fn();
    renderWithProviders(<LendItemDialog open onOpenChange={onOpenChange} itemTitle="Dune" onSubmit={onSubmit} />);

    fireEvent.change(screen.getByPlaceholderText("e.g. John Doe"), { target: { value: "  Bob  " } });
    fireEvent.click(screen.getByRole("button", { name: "Lend Item", hidden: false }));

    await waitFor(() => expect(onSubmit).toHaveBeenCalled());
    expect(onSubmit).toHaveBeenCalledWith({ contact_name: "Bob", due_date: null, notes: null });
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("shows a localized error instead of the raw exception text", async () => {
    const onSubmit = vi.fn().mockRejectedValue(new Error("HTTP 500 Internal Server Error"));
    renderWithProviders(<LendItemDialog open onOpenChange={vi.fn()} onSubmit={onSubmit} />, { language: "de" });

    fireEvent.change(screen.getByPlaceholderText("z. B. Max Mustermann"), { target: { value: "Bob" } });
    fireEvent.click(screen.getByRole("button", { name: "Artikel ausleihen", hidden: false }));

    expect(await screen.findByText("Das Medium konnte nicht verliehen werden. Bitte versuche es erneut.")).toBeInTheDocument();
    expect(screen.queryByText(/HTTP 500/)).toBeNull();
  });
});
