import React from "react";
import { render, screen } from "@testing-library/react";
import { SankeyCashflowView } from "../features/analytics/components/SankeyCashflowView";

describe("SankeyCashflowView", () => {
  it("renders the real aggregates passed in as props, not fabricated demo numbers", () => {
    render(
      <SankeyCashflowView
        loading={false}
        hasData={true}
        totalIncome={3123.45}
        totalAllocatedPlans={1811.1}
        totalPotsContribution={654.32}
        unassignedSurplus={657.03}
      />
    );

    // The formatted (de-DE currency) values derived from the real props must be present.
    expect(screen.getByText(/3\.123,45/)).toBeInTheDocument();
    expect(screen.getByText(/1\.811,10/)).toBeInTheDocument();
    expect(screen.getByText(/654,32/)).toBeInTheDocument();
    expect(screen.getByText(/657,03/)).toBeInTheDocument();

    // The old hardcoded demo figures from issue #537 must never appear.
    expect(screen.queryByText(/4\.500,00/)).not.toBeInTheDocument();
    expect(screen.queryByText(/2\.800,00/)).not.toBeInTheDocument();
    expect(screen.queryByText(/1\.200,00/)).not.toBeInTheDocument();
  });

  it("shows an honest empty state instead of any numbers when the household has no data", () => {
    render(
      <SankeyCashflowView
        loading={false}
        hasData={false}
        totalIncome={0}
        totalAllocatedPlans={0}
        totalPotsContribution={0}
        unassignedSurplus={0}
      />
    );

    // Default app language in tests without an explicit LanguageProvider is German (matching
    // production's default), so the empty state renders the German copy.
    expect(screen.getByText(/noch keine cashflow-daten/i)).toBeInTheDocument();
    expect(screen.queryByText(/4\.500,00/)).not.toBeInTheDocument();
    expect(screen.queryByText(/2\.800,00/)).not.toBeInTheDocument();
    expect(screen.queryByText(/1\.200,00/)).not.toBeInTheDocument();
    expect(screen.queryByText(/500,00/)).not.toBeInTheDocument();
  });

  it("shows a loading skeleton instead of any numbers while base data is still loading", () => {
    render(
      <SankeyCashflowView
        loading={true}
        hasData={false}
        totalIncome={0}
        totalAllocatedPlans={0}
        totalPotsContribution={0}
        unassignedSurplus={0}
      />
    );

    expect(screen.queryByText("Sankey Cashflow Flow")).not.toBeInTheDocument();
    expect(screen.queryByText(/4\.500,00/)).not.toBeInTheDocument();
  });
});
