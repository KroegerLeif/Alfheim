import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { axe } from "vitest-axe";
import { MetricStatCard } from "../MetricStatCard";

describe("MetricStatCard Component", () => {
  it("passes accessibility audit", async () => {
    const { container } = render(
      <MetricStatCard title="Net Worth" amount={15000} trendPercentage={5.2} trendLabel="vs last month" />
    );
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it("renders card title, amount, and trend percentage", () => {
    render(
      <MetricStatCard
        title="Total Income"
        amount={4500}
        trendPercentage={12.4}
        trendLabel="vs last month"
      />
    );

    expect(screen.getByText("Total Income")).toBeInTheDocument();
    expect(screen.getByText("+12.4%")).toBeInTheDocument();
    expect(screen.getByText("vs last month")).toBeInTheDocument();
  });

  it("formats negative trend percentage correctly", () => {
    render(
      <MetricStatCard
        title="Expenses"
        amount={2300}
        trendPercentage={-3.5}
      />
    );

    const trend = screen.getByText("-3.5%");
    expect(trend).toBeInTheDocument();
    expect(trend.className).toContain("text-rose-500");
  });
});
