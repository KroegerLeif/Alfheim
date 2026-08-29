import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi } from "vitest";
import { axe } from "vitest-axe";
import { ReceiptDropzone } from "../ReceiptDropzone";

describe("ReceiptDropzone Component", () => {
  it("passes accessibility audit when idle", async () => {
    const { container } = render(<ReceiptDropzone onFileSelect={() => {}} />);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it("renders dropzone instructions", () => {
    render(<ReceiptDropzone onFileSelect={() => {}} />);
    expect(screen.getByText(/Click to upload/i)).toBeInTheDocument();
    expect(screen.getByText(/drag and drop/i)).toBeInTheDocument();
  });

  it("handles file selection via file input", async () => {
    const handleFileSelect = vi.fn();
    render(<ReceiptDropzone onFileSelect={handleFileSelect} />);

    const file = new File(["dummy content"], "receipt.png", { type: "image/png" });
    const input = screen.getByTestId("receipt-input") as HTMLInputElement;

    await userEvent.upload(input, file);
    expect(handleFileSelect).toHaveBeenCalledWith(file);
  });

  it("displays selected file details and allows removal", async () => {
    const handleFileSelect = vi.fn();
    const file = new File(["receipt data"], "invoice.pdf", { type: "application/pdf" });

    render(<ReceiptDropzone onFileSelect={handleFileSelect} selectedFile={file} />);

    expect(screen.getByText("invoice.pdf")).toBeInTheDocument();

    const removeButton = screen.getByRole("button", { name: /Remove file/i });
    await userEvent.click(removeButton);

    expect(handleFileSelect).toHaveBeenCalledWith(null);
  });

  it("displays error message if file exceeds maxSizeMB", () => {
    const handleFileSelect = vi.fn();
    render(<ReceiptDropzone onFileSelect={handleFileSelect} maxSizeMB={1} />);

    // Create file > 1MB
    const largeFile = new File([new ArrayBuffer(2 * 1024 * 1024)], "large.png", {
      type: "image/png",
    });

    const input = screen.getByTestId("receipt-input") as HTMLInputElement;
    fireEvent.change(input, { target: { files: [largeFile] } });

    expect(handleFileSelect).not.toHaveBeenCalled();
    expect(screen.getByText(/File exceeds maximum size of 1MB/i)).toBeInTheDocument();
  });
});
