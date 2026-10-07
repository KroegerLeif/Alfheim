import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen, fireEvent, waitFor } from "@testing-library/react";
import { renderWithProviders } from "@/tests/renderWithProviders";
import { manualsApi } from "../api/manualsApi";
import { ManualSection } from "../components/ManualSection";
import { ManualUploadButton } from "../components/ManualUploadButton";
import { ManualViewerModal } from "../components/ManualViewerModal";

vi.mock("../api/manualsApi", () => ({
  manualsApi: { uploadManual: vi.fn(), getManualUrl: vi.fn(), deleteManual: vi.fn() },
}));

describe("ManualSection", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("shows the localized upload state and offers view and delete when a manual exists", () => {
    renderWithProviders(<ManualSection itemId="i" itemTitle="Catan" manualS3Key="manuals/x.pdf" />, { language: "de" });
    expect(screen.getByText("Hochgeladen")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Anleitung ansehen" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Anleitung löschen" })).toBeInTheDocument();
  });

  it("maps a failed manual delete to a localized message instead of the exception text", async () => {
    vi.spyOn(window, "confirm").mockReturnValue(true);
    vi.mocked(manualsApi.deleteManual).mockRejectedValue(new Error("Request failed with status code 500"));
    renderWithProviders(<ManualSection itemId="i" itemTitle="Catan" manualS3Key="manuals/x.pdf" />);

    fireEvent.click(screen.getByRole("button", { name: "Delete Manual" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Failed to delete manual.");
    expect(screen.queryByText(/status code 500/)).toBeNull();
  });

  it("does not delete when the confirmation is declined", () => {
    vi.spyOn(window, "confirm").mockReturnValue(false);
    renderWithProviders(<ManualSection itemId="i" itemTitle="Catan" manualS3Key="manuals/x.pdf" />);

    fireEvent.click(screen.getByRole("button", { name: "Delete Manual" }));
    expect(manualsApi.deleteManual).not.toHaveBeenCalled();
  });

  it("opens the viewer and reports a link that cannot be loaded", async () => {
    vi.mocked(manualsApi.getManualUrl).mockRejectedValue(new Error("boom"));
    renderWithProviders(<ManualSection itemId="i" itemTitle="Catan" manualS3Key="manuals/x.pdf" />);

    fireEvent.click(screen.getByRole("button", { name: "View Manual" }));

    await waitFor(() => expect(screen.getAllByText("Failed to load manual link.").length).toBeGreaterThan(0));
  });
});

describe("ManualUploadButton", () => {
  it("rejects non-PDF files with a localized message", () => {
    const onFileSelect = vi.fn();
    const { container } = renderWithProviders(
      <ManualUploadButton onFileSelect={onFileSelect} isUploading={false} />,
      { language: "pl" }
    );
    const input = container.querySelector('input[type="file"]') as HTMLInputElement;

    fireEvent.change(input, { target: { files: [new File(["x"], "notes.txt", { type: "text/plain" })] } });

    expect(screen.getByText("Dozwolone są tylko pliki PDF.")).toBeInTheDocument();
    expect(onFileSelect).not.toHaveBeenCalled();
  });

  it("passes a PDF on and shows the busy label while uploading", async () => {
    const onFileSelect = vi.fn().mockResolvedValue(undefined);
    const { container, rerender } = renderWithProviders(
      <ManualUploadButton onFileSelect={onFileSelect} isUploading={false} />
    );
    const input = container.querySelector('input[type="file"]') as HTMLInputElement;
    const pdf = new File(["x"], "manual.pdf", { type: "application/pdf" });

    fireEvent.change(input, { target: { files: [pdf] } });
    await waitFor(() => expect(onFileSelect).toHaveBeenCalledWith(pdf));

    rerender(<ManualUploadButton onFileSelect={onFileSelect} isUploading />);
    expect(screen.getByRole("button", { name: "Uploading..." })).toBeDisabled();
  });
});

describe("ManualViewerModal", () => {
  it("uses the localized loading label and wraps a long title", () => {
    const longTitle = "Spielanleitung".repeat(20);
    renderWithProviders(
      <ManualViewerModal open onOpenChange={vi.fn()} title={longTitle} pdfUrl={null} isLoading />
    );
    expect(screen.getByText("Loading...")).toBeInTheDocument();
    expect(screen.getByRole("heading")).toHaveClass("break-words");
  });

  it("embeds the PDF and links to it in a new tab", () => {
    renderWithProviders(
      <ManualViewerModal open onOpenChange={vi.fn()} title="Catan" pdfUrl="https://s3.example.com/m.pdf" isLoading={false} />
    );
    expect(screen.getByTitle("Catan")).toHaveAttribute("src", "https://s3.example.com/m.pdf");
    expect(screen.getByRole("link", { name: "Open PDF in new tab" })).toHaveAttribute("target", "_blank");
  });
});
