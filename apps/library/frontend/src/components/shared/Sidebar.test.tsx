import { describe, it, expect, vi } from "vitest";
import { screen } from "@testing-library/react";
import { renderWithProviders } from "@/tests/renderWithProviders";
import { Sidebar } from "./Sidebar";

vi.mock("next/navigation", () => ({ usePathname: () => "/en/lending" }));

describe("Sidebar", () => {
  it("lists the four sections with lucide icons instead of Material Symbols", () => {
    const { container } = renderWithProviders(<Sidebar />, { language: "de" });

    for (const label of ["Katalog", "Lagerorte", "Ausleihe", "Streaming-Anbieter"]) {
      expect(screen.getByText(label)).toBeInTheDocument();
    }
    expect(container.querySelectorAll("svg.lucide").length).toBeGreaterThanOrEqual(4);
    expect(container.querySelector(".material-symbols-outlined")).toBeNull();
  });
});
