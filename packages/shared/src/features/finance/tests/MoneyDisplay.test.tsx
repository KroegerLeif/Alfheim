import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { axe } from "vitest-axe";
import { MoneyDisplay } from "../MoneyDisplay";

describe("MoneyDisplay Component", () => {
  it("passes accessibility audit", async () => {
    const { container } = render(<MoneyDisplay amount={123.45} currency="EUR" />);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it("renders formatted currency amount correctly", () => {
    render(<MoneyDisplay amount={100} currency="EUR" locale="en-US" />);
    expect(screen.getByText("€100.00")).toBeInTheDocument();
  });

  it("applies green color for positive amounts when colored is true", () => {
    render(<MoneyDisplay amount={50} colored />);
    const elem = screen.getByText(/50/);
    expect(elem.className).toContain("text-emerald-500");
  });

  it("applies red color for negative amounts when colored is true", () => {
    render(<MoneyDisplay amount={-50} colored />);
    const elem = screen.getByText(/-50/);
    expect(elem.className).toContain("text-rose-500");
  });

  it("shows explicit positive sign when showSign is true", () => {
    render(<MoneyDisplay amount={25} showSign locale="en-US" currency="EUR" />);
    expect(screen.getByText("+€25.00")).toBeInTheDocument();
  });
});
