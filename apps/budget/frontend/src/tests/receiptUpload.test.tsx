import React from "react";
import { screen, fireEvent, waitFor } from "@testing-library/react";
import { vi } from "vitest";
import { QuickAddModal } from "../features/transactions";
import { transactionsApi } from "../features/transactions/api/transactionsApi";
import { renderWithProviders } from "./utils";

// Regression tests for issues #529 and #802: the frontend uploads the receipt to the backend
// (multipart; the browser never sends file bytes to object storage) and attaches the resulting
// server-generated object key to the transaction as
// `receipt_url`. OCR extraction is deliberately NOT exposed here -- see the comment in
// transactionsApi.ts and the PR description for why.

vi.mock("../features/transactions/api/transactionsApi", async () => {
  const actual = await vi.importActual<Record<string, unknown>>(
    "../features/transactions/api/transactionsApi"
  );
  return {
    ...actual,
    transactionsApi: {
      ...(actual.transactionsApi as Record<string, unknown>),
      uploadReceipt: vi.fn().mockResolvedValue({
        object_key: "households/hh-1/budget/receipts/0123abcd.webp",
        content_type: "image/webp",
      }),
    },
  };
});

describe("QuickAddModal receipt upload", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("uploads the selected receipt and includes its object key as receipt_url on submit", async () => {
    const handleSubmit = vi.fn().mockResolvedValue(undefined);
    renderWithProviders(
      <QuickAddModal open={true} onClose={() => {}} onSubmit={handleSubmit} />
    );

    fireEvent.change(screen.getByPlaceholderText(/supermarket/i), {
      target: { value: "Groceries" },
    });
    fireEvent.change(screen.getByPlaceholderText("25.50"), { target: { value: "12.50" } });

    const file = new File(["receipt-bytes"], "receipt.jpg", { type: "image/jpeg" });
    const fileInput = document.getElementById("transaction-receipt") as HTMLInputElement;
    fireEvent.change(fileInput, { target: { files: [file] } });

    fireEvent.submit(fileInput.closest("form")!);

    await waitFor(() => {
      expect(transactionsApi.uploadReceipt).toHaveBeenCalledWith(file);
    });
    expect(handleSubmit).toHaveBeenCalledWith(
      expect.objectContaining({
        receipt_url: "households/hh-1/budget/receipts/0123abcd.webp",
      })
    );
  });

  it("submits without a receipt_url when no file was attached", async () => {
    const handleSubmit = vi.fn().mockResolvedValue(undefined);
    renderWithProviders(
      <QuickAddModal open={true} onClose={() => {}} onSubmit={handleSubmit} />
    );

    fireEvent.change(screen.getByPlaceholderText(/supermarket/i), {
      target: { value: "Groceries" },
    });
    fireEvent.change(screen.getByPlaceholderText("25.50"), { target: { value: "12.50" } });
    fireEvent.submit(screen.getByPlaceholderText("25.50").closest("form")!);

    await waitFor(() => {
      expect(handleSubmit).toHaveBeenCalled();
    });
    expect(transactionsApi.uploadReceipt).not.toHaveBeenCalled();
    expect(handleSubmit).toHaveBeenCalledWith(expect.objectContaining({ receipt_url: null }));
  });

  it("shows an error and does not submit the transaction when the receipt upload fails", async () => {
    (transactionsApi.uploadReceipt as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
      new Error("Upload service unavailable")
    );
    const handleSubmit = vi.fn().mockResolvedValue(undefined);
    renderWithProviders(
      <QuickAddModal open={true} onClose={() => {}} onSubmit={handleSubmit} />
    );

    fireEvent.change(screen.getByPlaceholderText(/supermarket/i), {
      target: { value: "Groceries" },
    });
    fireEvent.change(screen.getByPlaceholderText("25.50"), { target: { value: "12.50" } });

    const file = new File(["receipt-bytes"], "receipt.jpg", { type: "image/jpeg" });
    const fileInput = document.getElementById("transaction-receipt") as HTMLInputElement;
    fireEvent.change(fileInput, { target: { files: [file] } });
    fireEvent.submit(fileInput.closest("form")!);

    await waitFor(() => {
      expect(screen.getByText(/Upload service unavailable/i)).toBeInTheDocument();
    });
    expect(handleSubmit).not.toHaveBeenCalled();
  });
});
