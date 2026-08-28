import React from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi } from "vitest";
import { axe } from "vitest-axe";
import { CurrencyInput } from "../CurrencyInput";

describe("CurrencyInput Component", () => {
  it("passes accessibility audit", async () => {
    const { container } = render(
      <CurrencyInput value="10.50" onChange={() => {}} aria-label="Amount" />
    );
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it("renders currency symbol and value", () => {
    render(
      <CurrencyInput value="50.00" currencySymbol="$" onChange={() => {}} aria-label="Amount" />
    );
    expect(screen.getByText("$")).toBeInTheDocument();
    expect(screen.getByDisplayValue("50.00")).toBeInTheDocument();
  });

  it("calls onChange when valid numeric input is typed", async () => {
    const handleChange = vi.fn();
    const user = userEvent.setup();

    render(<CurrencyInput value="" onChange={handleChange} aria-label="Amount" />);
    const input = screen.getByRole("textbox");

    await user.type(input, "12.5");
    expect(handleChange).toHaveBeenCalled();
  });

  it("displays error message when provided", () => {
    render(
      <CurrencyInput
        value="0"
        onChange={() => {}}
        error="Invalid amount"
        aria-label="Amount"
      />
    );
    expect(screen.getByText("Invalid amount")).toBeInTheDocument();
  });
});
