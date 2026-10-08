import { screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { renderWithI18n } from "@/tests/test-utils";
import ErrorPage from "@/app/[locale]/error";
import Loading from "@/app/[locale]/loading";

describe("route state pages", () => {
  it("renders the error page in the active language and lets the user retry", () => {
    const reset = vi.fn();
    const spy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    renderWithI18n(<ErrorPage error={new Error("Kaputt")} reset={reset} />, "de");

    expect(screen.getByRole("heading", { name: "Etwas ist schiefgelaufen" })).toBeInTheDocument();
    expect(screen.getByText("Kaputt")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Erneut versuchen" }));
    expect(reset).toHaveBeenCalledTimes(1);
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });

  it("uses a localized generic message when the error has none", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    renderWithI18n(<ErrorPage error={new Error("")} reset={vi.fn()} />, "en");

    expect(screen.getByText("An unexpected error occurred while loading this page.")).toBeInTheDocument();
    spy.mockRestore();
  });

  it("wraps a very long error message", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const message = "e".repeat(400);
    renderWithI18n(<ErrorPage error={new Error(message)} reset={vi.fn()} />);

    expect(screen.getByText(message)).toHaveClass("break-words");
    spy.mockRestore();
  });

  it("renders the loading page in the active language", () => {
    renderWithI18n(<Loading />, "pl");

    expect(screen.getByRole("status")).toHaveTextContent("Ładowanie");
  });
});
