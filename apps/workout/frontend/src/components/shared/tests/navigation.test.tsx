import { screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { renderHook } from "@testing-library/react";
import { LanguageProvider } from "@alfheim/shared";
import { renderWithI18n } from "@/tests/test-utils";
import { useActiveNavHref, useWorkoutNavItems } from "../navItems";
import { WorkoutBottomNav } from "../WorkoutBottomNav";

describe("navigation", () => {
  it("lists the four primary destinations in the active language", () => {
    const { result } = renderHook(() => useWorkoutNavItems(), {
      wrapper: ({ children }) => <LanguageProvider defaultLanguage="de">{children}</LanguageProvider>,
    });

    expect(result.current.map((item) => [item.href, item.label])).toEqual([
      ["/", "Heute"],
      ["/plans", "Pläne"],
      ["/catalog", "Katalog"],
      ["/analytics", "Auswertung"],
    ]);
  });

  it("matches nothing for an unknown path (the router mock reports an empty pathname)", () => {
    const { result } = renderHook(() => {
      const items = useWorkoutNavItems();
      return useActiveNavHref(items);
    });

    expect(result.current).toBeUndefined();
  });

  it("renders the bottom bar with a localized label and links", () => {
    renderWithI18n(<WorkoutBottomNav />, "pl");

    expect(screen.getByRole("navigation", { name: "Workout Tracker" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Dzisiaj" })).toHaveAttribute("href", "/");
    expect(screen.getByRole("link", { name: "Plany" })).toHaveAttribute("href", "/plans");
  });
});
