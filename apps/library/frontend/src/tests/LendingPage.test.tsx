import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen, fireEvent, waitFor } from "@testing-library/react";
import { renderWithProviders } from "@/tests/renderWithProviders";
import { lendingApi } from "@/features/lending/api/lendingApi";
import { makeRecord } from "@/features/lending/tests/fixtures";
import LendingPage from "../app/[locale]/lending/page";

vi.mock("@/features/lending/api/lendingApi", () => ({
  lendingApi: { getLendingHistory: vi.fn(), lendItem: vi.fn(), returnItem: vi.fn() },
}));

const active = makeRecord();
const returned = makeRecord({ id: "rec-2", item_title: "Emma", status: "AVAILABLE" });

function mockHistory(total = 2) {
  vi.mocked(lendingApi.getLendingHistory).mockImplementation(async (params) => ({
    records: params?.status === "LENT_OUT" ? [active] : [active, returned],
    total,
    skip: 0,
    limit: 100,
  }));
}

describe("LendingPage", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("shows open loans with titles and switches to the history tab", async () => {
    mockHistory();
    renderWithProviders(<LendingPage />);

    expect(await screen.findByRole("heading", { name: "Dune" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Active Loans (1)" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Lending History (2)" }));
    expect(await screen.findByText("Emma")).toBeInTheDocument();
  });

  it("tells the user when the history is capped", async () => {
    mockHistory(250);
    renderWithProviders(<LendingPage />);
    await screen.findByRole("heading", { name: "Dune" });

    fireEvent.click(screen.getByRole("button", { name: "Lending History (2)" }));
    expect(screen.getByText("Showing the latest 2 of 250 records.")).toBeInTheDocument();
  });

  it("surfaces a failed return as a banner and keeps the loan listed", async () => {
    mockHistory();
    vi.mocked(lendingApi.returnItem).mockRejectedValue(new Error("boom"));
    renderWithProviders(<LendingPage />);

    fireEvent.click(await screen.findByRole("button", { name: "Mark as Returned" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Could not mark the item as returned");
    expect(screen.getByRole("heading", { name: "Dune" })).toBeInTheDocument();
  });

  it("shows the load error on both tabs instead of an empty list", async () => {
    vi.mocked(lendingApi.getLendingHistory).mockRejectedValue(new Error("boom"));
    renderWithProviders(<LendingPage />, { language: "de" });

    expect(await screen.findByText("Verleihverlauf konnte nicht geladen werden")).toBeInTheDocument();
    expect(screen.queryByText("Derzeit sind keine Artikel ausgeliehen.")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: /Verleih-Historie/ }));
    await waitFor(() =>
      expect(screen.getByText("Verleihverlauf konnte nicht geladen werden")).toBeInTheDocument()
    );
  });
});
