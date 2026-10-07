import { screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { renderWithI18n } from "@/tests/test-utils";
import { ConfirmDialog } from "../ConfirmDialog";
import { InlineError } from "../InlineError";

describe("InlineError", () => {
  it("renders nothing without a message", () => {
    const { container } = renderWithI18n(<InlineError message={null} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("announces the message as an alert and wraps long text", () => {
    const long = "x".repeat(300);
    renderWithI18n(<InlineError message={long} className="mt-2" />);

    const alert = screen.getByRole("alert");
    expect(alert).toHaveTextContent(long);
    expect(alert).toHaveClass("break-words", "mt-2");
  });
});

describe("ConfirmDialog", () => {
  const baseProps = {
    title: "Delete Plan",
    description: "Really delete plan?",
    confirmLabel: "Delete Plan",
    onOpenChange: vi.fn(),
    onConfirm: vi.fn(),
  };

  it("is hidden while closed", () => {
    renderWithI18n(<ConfirmDialog {...baseProps} open={false} />);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("confirms and cancels", () => {
    const onConfirm = vi.fn();
    const onOpenChange = vi.fn();
    renderWithI18n(<ConfirmDialog {...baseProps} open onConfirm={onConfirm} onOpenChange={onOpenChange} />);

    expect(screen.getByRole("dialog", { name: "Delete Plan" })).toHaveTextContent("Really delete plan?");
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(onOpenChange).toHaveBeenCalledWith(false);

    const confirm = screen.getAllByRole("button", { name: "Delete Plan" }).at(-1) as HTMLElement;
    fireEvent.click(confirm);
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it("disables both buttons while the action is running", () => {
    renderWithI18n(<ConfirmDialog {...baseProps} open isPending />);

    expect(screen.getByRole("button", { name: "Cancel" })).toBeDisabled();
    expect(screen.getAllByRole("button", { name: "Delete Plan" }).at(-1)).toBeDisabled();
  });

  it("is translated", () => {
    renderWithI18n(<ConfirmDialog {...baseProps} open />, "de");
    expect(screen.getByRole("button", { name: "Abbrechen" })).toBeInTheDocument();
  });
});
