import React from "react";
import { render, screen } from "@testing-library/react";
import BudgetHomePage from "@/app/[locale]/page";

describe("BudgetHomePage", () => {
  it("renders page heading and navigation controls", () => {
    render(<BudgetHomePage />);
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Budget & Treasury");
    expect(screen.getAllByText("Dashboard")[0]).toBeInTheDocument();
  });
});
