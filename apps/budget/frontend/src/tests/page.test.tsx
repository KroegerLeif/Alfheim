import { render, screen } from "@testing-library/react";
import BudgetHomePage from "@/app/[locale]/page";

describe("BudgetHomePage", () => {
  it("renders page heading correctly", () => {
    render(<BudgetHomePage />);
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Budget & Treasury");
  });
});
