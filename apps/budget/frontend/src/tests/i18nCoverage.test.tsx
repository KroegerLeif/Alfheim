import React from "react";
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { LanguageProvider } from "@alfheim/shared";
import { DesktopSidebar } from "../features/navigation";

// Regression tests for issue #543: sidebar/dashboard/analytics chrome was hardcoded English and
// never routed through the shared translation dictionary, so switching the app language left it
// untranslated. These tests render real (un-mocked) translated components against both the en
// and de dictionaries and assert the sidebar no longer falls back to raw, unresolved keys.

function renderInLanguage(ui: React.ReactElement, language: "en" | "de") {
  return render(<LanguageProvider defaultLanguage={language}>{ui}</LanguageProvider>);
}

describe("Budget i18n coverage", () => {
  it("renders the desktop sidebar in German without falling back to raw translation keys", () => {
    renderInLanguage(<DesktopSidebar currentPath="/" />, "de");

    expect(screen.getByText("Dashboard")).toBeInTheDocument();
    expect(screen.getByText("Budgetplanung")).toBeInTheDocument();
    expect(screen.getByText("Virtuelle Töpfe")).toBeInTheDocument();
    expect(screen.queryByText(/budget\.navigation\./)).not.toBeInTheDocument();
  });

  it("renders the desktop sidebar in English without falling back to raw translation keys", () => {
    renderInLanguage(<DesktopSidebar currentPath="/" />, "en");

    expect(screen.getByText("Dashboard")).toBeInTheDocument();
    expect(screen.queryByText(/budget\.navigation\./)).not.toBeInTheDocument();
  });
});
