import { describe, it, expect, vi } from "vitest";
import { screen, fireEvent } from "@testing-library/react";
import { renderWithProviders } from "@/tests/renderWithProviders";
import { MediaSpecificFields } from "../MediaSpecificFields";
import type { ItemFormData } from "../types";

const base: ItemFormData = { title: "x", media_type: "BOOK", is_cookbook: false };

describe("MediaSpecificFields", () => {
  it("shows ISBN and the cookbook flag for books", () => {
    const onChange = vi.fn();
    renderWithProviders(<MediaSpecificFields formData={base} onChange={onChange} />);

    fireEvent.change(screen.getByRole("textbox"), { target: { value: "978" } });
    fireEvent.click(screen.getByRole("checkbox", { name: "Is Cookbook" }));
    expect(onChange).toHaveBeenCalledWith({ isbn_gtin: "978" });
    expect(onChange).toHaveBeenCalledWith({ is_cookbook: true });
  });

  it("shows player counts and play time for games and parses the numbers", () => {
    const onChange = vi.fn();
    renderWithProviders(<MediaSpecificFields formData={{ ...base, media_type: "GAME", max_players: 4 }} onChange={onChange} />);

    const [min, max, time] = screen.getAllByRole("spinbutton");
    fireEvent.change(min, { target: { value: "2" } });
    fireEvent.change(max, { target: { value: "" } });
    fireEvent.change(time, { target: { value: "45" } });
    expect(onChange).toHaveBeenCalledWith({ min_players: 2 });
    expect(onChange).toHaveBeenCalledWith({ max_players: null });
    expect(onChange).toHaveBeenCalledWith({ runtime_minutes: 45 });
    expect(screen.queryByText("Age Rating")).toBeNull();
  });

  it("shows runtime and age rating for movies and keeps an FSK of zero", () => {
    const onChange = vi.fn();
    renderWithProviders(
      <MediaSpecificFields formData={{ ...base, media_type: "MOVIE", fsk_rating: 0, runtime_minutes: 90 }} onChange={onChange} />
    );

    const [time, fsk] = screen.getAllByRole("spinbutton");
    expect((fsk as HTMLInputElement).value).toBe("0");
    fireEvent.change(fsk, { target: { value: "16" } });
    fireEvent.change(time, { target: { value: "" } });
    expect(onChange).toHaveBeenCalledWith({ fsk_rating: 16 });
    expect(onChange).toHaveBeenCalledWith({ runtime_minutes: null });
  });
});
