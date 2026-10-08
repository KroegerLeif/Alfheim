import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { vi } from "vitest";
import { AccountDialog } from "../features/accounts";
import { PotDialog, CascadeModal, potsApi } from "../features/pots";
import { PlanDialog, CategoryDialog } from "../features/plans";
import { QuickAddModal, transactionsApi, ReceiptUploadError } from "../features/transactions";
import { longAccount } from "./fixtures";

// A rejected save must keep the dialog open and show the failure inline instead of leaving an
// unhandled rejection and a form that silently does nothing. Rendered without a LanguageProvider,
// which uses the default German dictionary.

const GENERIC_FALLBACK = "Etwas ist schiefgelaufen. Bitte versuchen Sie es erneut.";

function submitForm(trigger: HTMLElement) {
  fireEvent.submit(trigger.closest("form")!);
}

describe("dialogs surface failed saves", () => {
  it("AccountDialog shows the server message and stays open", async () => {
    const onClose = vi.fn();
    const onSubmit = vi.fn().mockRejectedValue(new Error("Account name already exists"));
    render(<AccountDialog open account={null} onClose={onClose} onSubmit={onSubmit} />);

    fireEvent.change(screen.getByLabelText("Kontoname"), { target: { value: "Main" } });
    submitForm(screen.getByLabelText("Kontoname"));

    expect(await screen.findByRole("alert")).toHaveTextContent("Account name already exists");
    expect(onClose).not.toHaveBeenCalled();
  });

  it("AccountDialog falls back to the localized message when the server sends none", async () => {
    const onSubmit = vi.fn().mockRejectedValue(new Error(""));
    render(<AccountDialog open account={longAccount} onClose={vi.fn()} onSubmit={onSubmit} />);

    submitForm(screen.getByLabelText("Kontoname"));

    expect(await screen.findByRole("alert")).toHaveTextContent(GENERIC_FALLBACK);
  });

  it("AccountDialog closes after a successful save", async () => {
    const onClose = vi.fn();
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    render(<AccountDialog open account={longAccount} onClose={onClose} onSubmit={onSubmit} />);

    submitForm(screen.getByLabelText("Kontoname"));

    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("PotDialog shows the failure", async () => {
    const onClose = vi.fn();
    render(<PotDialog open pot={null} onClose={onClose} onSubmit={vi.fn().mockRejectedValue(new Error("Priority taken"))} />);

    fireEvent.change(screen.getByLabelText("Name des Topfs"), { target: { value: "Reserve" } });
    submitForm(screen.getByLabelText("Name des Topfs"));

    expect(await screen.findByRole("alert")).toHaveTextContent("Priority taken");
    expect(onClose).not.toHaveBeenCalled();
  });

  it("PlanDialog shows the failure", async () => {
    const onClose = vi.fn();
    render(<PlanDialog open plan={null} onClose={onClose} onSubmit={vi.fn().mockRejectedValue(new Error("Plan overlaps"))} />);

    fireEvent.change(screen.getByLabelText("Planname"), { target: { value: "November" } });
    submitForm(screen.getByLabelText("Planname"));

    expect(await screen.findByRole("alert")).toHaveTextContent("Plan overlaps");
    expect(onClose).not.toHaveBeenCalled();
  });

  it("CategoryDialog shows the failure and keeps the typed name", async () => {
    const onClose = vi.fn();
    render(<CategoryDialog open onClose={onClose} onSubmit={vi.fn().mockRejectedValue(new Error("Duplicate category"))} />);

    const name = screen.getByLabelText("Kategoriename");
    fireEvent.change(name, { target: { value: "Groceries" } });
    submitForm(name);

    expect(await screen.findByRole("alert")).toHaveTextContent("Duplicate category");
    expect(name).toHaveValue("Groceries");
    expect(onClose).not.toHaveBeenCalled();
  });

  it("CascadeModal shows the failure instead of only logging it", async () => {
    const spy = vi.spyOn(potsApi, "allocateCascade").mockRejectedValue(new Error("No pots configured"));
    render(<CascadeModal open onClose={vi.fn()} onSuccess={vi.fn()} />);

    const amount = screen.getByLabelText("Gesamter Überschussbetrag");
    fireEvent.change(amount, { target: { value: "500" } });
    submitForm(amount);

    expect(await screen.findByRole("alert")).toHaveTextContent("No pots configured");
    spy.mockRestore();
  });

  it("CascadeModal lists the allocations after a successful run", async () => {
    const spy = vi.spyOn(potsApi, "allocateCascade").mockResolvedValue({
      total_allocated: 300,
      remaining_unassigned: 200,
      overflow_to_investment: 0,
      allocations: [
        { pot_id: "p1", pot_name: "Reserve", priority: 1, allocated_amount: 300, new_current_amount: 300, is_filled: false },
      ],
    });
    const onSuccess = vi.fn();
    render(<CascadeModal open onClose={vi.fn()} onSuccess={onSuccess} />);

    const amount = screen.getByLabelText("Gesamter Überschussbetrag");
    fireEvent.change(amount, { target: { value: "500" } });
    submitForm(amount);

    expect(await screen.findByText("Kaskade abgeschlossen")).toBeInTheDocument();
    expect(screen.getByText("Reserve")).toBeInTheDocument();
    expect(onSuccess).toHaveBeenCalledTimes(1);
    spy.mockRestore();
  });
});

describe("QuickAddModal", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("books the amount in the selected account's currency instead of one implied by the language", async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    render(<QuickAddModal open accounts={[{ ...longAccount, name: "Dollar account", currency: "USD" }]} onClose={vi.fn()} onSubmit={onSubmit} />);

    expect(screen.getByText("Betrag (EUR)")).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText(/Beschreibung/), { target: { value: "Coffee" } });
    fireEvent.change(screen.getByLabelText("Betrag (EUR)"), { target: { value: "4.5" } });
    fireEvent.change(screen.getByLabelText(/Konto \(Optional\)/), { target: { value: longAccount.id } });

    expect(screen.getByText("Betrag (USD)")).toBeInTheDocument();
    submitForm(screen.getByLabelText("Betrag (USD)"));

    await waitFor(() => expect(onSubmit).toHaveBeenCalled());
    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ currency: "USD", amount: 4.5, account_id: longAccount.id }));
  });

  it("shows a localized message when the presigned receipt upload is rejected", async () => {
    vi.spyOn(transactionsApi, "getReceiptUploadUrl").mockResolvedValue({ upload_url: "https://s3.test/put", object_key: "k" });
    vi.spyOn(transactionsApi, "uploadReceiptFile").mockRejectedValue(new ReceiptUploadError(403));
    const onSubmit = vi.fn();
    render(<QuickAddModal open onClose={vi.fn()} onSubmit={onSubmit} />);

    fireEvent.change(screen.getByLabelText(/Beschreibung/), { target: { value: "Coffee" } });
    fireEvent.change(screen.getByLabelText("Betrag (EUR)"), { target: { value: "4.5" } });
    const file = new File(["x"], "receipt.png", { type: "image/png" });
    fireEvent.change(document.getElementById("transaction-receipt")!, { target: { files: [file] } });
    submitForm(screen.getByLabelText("Betrag (EUR)"));

    expect(await screen.findByRole("alert")).toHaveTextContent("Beleg-Upload fehlgeschlagen (Status 403).");
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("shows the failure when booking the transaction fails and keeps the dialog open", async () => {
    const onClose = vi.fn();
    render(<QuickAddModal open onClose={onClose} onSubmit={vi.fn().mockRejectedValue(new Error("Pot is archived"))} />);

    fireEvent.change(screen.getByLabelText(/Beschreibung/), { target: { value: "Coffee" } });
    fireEvent.change(screen.getByLabelText("Betrag (EUR)"), { target: { value: "4.5" } });
    submitForm(screen.getByLabelText("Betrag (EUR)"));

    expect(await screen.findByRole("alert")).toHaveTextContent("Pot is archived");
    expect(onClose).not.toHaveBeenCalled();
  });
});
