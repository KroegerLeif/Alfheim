import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { axe } from "vitest-axe";
import { MoneyDisplay } from "../MoneyDisplay";
import { LanguageProvider } from "../../i18n/utils/LanguageContext";

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

  it("formats with the active UI language when no locale is given", () => {
    render(
      <LanguageProvider defaultLanguage="en">
        <MoneyDisplay amount={1234.5} currency="EUR" />
      </LanguageProvider>
    );
    expect(screen.getByText("€1,234.50")).toBeInTheDocument();
  });

  it("lets an explicit locale override the active UI language", () => {
    render(
      <LanguageProvider defaultLanguage="en">
        <MoneyDisplay amount={1234.5} currency="EUR" locale="de-DE" />
      </LanguageProvider>
    );
    expect(screen.getByText(/1\.234,50/)).toBeInTheDocument();
  });
});
