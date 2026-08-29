import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { axe } from "vitest-axe";
import { BucketMeter } from "../BucketMeter";

describe("BucketMeter Component", () => {
  it("passes accessibility audit", async () => {
    const { container } = render(
      <BucketMeter name="Emergency Fund" currentAmount={500} targetAmount={1000} priority={1} />
    );
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it("renders pot name, amounts, and priority label", () => {
    render(
      <BucketMeter name="Vacation Pot" currentAmount={250} targetAmount={1000} priority={2} />
    );

    expect(screen.getByText("Vacation Pot")).toBeInTheDocument();
    expect(screen.getByText("P2")).toBeInTheDocument();
    expect(screen.getByText("25.0%")).toBeInTheDocument();
  });

  it("calculates percentage accurately", () => {
    render(<BucketMeter name="Car Repair" currentAmount={750} targetAmount={1000} />);
    expect(screen.getByText("75.0%")).toBeInTheDocument();
  });
});
