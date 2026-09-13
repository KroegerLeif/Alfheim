import React from "react";
import { screen } from "@testing-library/react";
import BudgetHomePage from "@/app/[locale]/page";
import { renderWithProviders } from "./utils";

describe("BudgetHomePage", () => {
  it("renders page heading and navigation controls", () => {
    renderWithProviders(<BudgetHomePage />);
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Budget & Treasury");
    expect(screen.getAllByText("Dashboard")[0]).toBeInTheDocument();
  });
});
