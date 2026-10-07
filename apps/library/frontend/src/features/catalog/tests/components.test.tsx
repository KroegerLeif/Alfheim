import { describe, it, expect, vi } from "vitest";
import { screen, fireEvent } from "@testing-library/react";
import { renderWithProviders } from "@/tests/renderWithProviders";
import { CatalogFilterBar } from "../components/CatalogFilterBar";
import { CatalogGrid } from "../components/CatalogGrid";
import { CatalogPager } from "../components/CatalogPager";
import { ItemCard } from "../components/ItemCard";
import { makeItem } from "./fixtures";

const LONG_WORD = "Donaudampfschifffahrtsgesellschaftskapitaensmuetze".repeat(4);
const LONG_TEXT = "A very long description that keeps going ".repeat(30);

describe("ItemCard with very long content", () => {
  it("clamps and wraps title, creator, description, location and specs instead of overflowing", () => {
    const { container } = renderWithProviders(
      <ItemCard
        item={makeItem({
          title: LONG_WORD,
          author_creator: LONG_WORD,
          description: LONG_TEXT,
          media_type: "GAME",
          min_players: 2,
          max_players: 6,
          runtime_minutes: 90,
          is_cookbook: true,
          manual_s3_key: "manuals/x.pdf",
        })}
        locationName={LONG_WORD}
      />
    );

    const title = screen.getByRole("heading", { name: LONG_WORD });
    expect(title).toHaveClass("break-words", "line-clamp-2");
    expect(screen.getByText(LONG_TEXT.trim())).toHaveClass("break-words", "line-clamp-2");
    const authors = screen.getAllByText(LONG_WORD).filter((el) => el.tagName === "P");
    expect(authors[0]).toHaveClass("break-words", "line-clamp-1");
    const location = screen.getAllByText(LONG_WORD).find((el) => el.className.includes("truncate"));
    expect(location).toBeDefined();
    expect(container.firstElementChild).toHaveClass("overflow-hidden");
    // Badges must not cover the lending status chip in the opposite corner.
    expect(screen.getByText("Board Games").parentElement).toHaveClass("max-w-[60%]");
  });

  it("shows localized badges and specs in German and Polish", () => {
    const item = makeItem({ media_type: "GAME", min_players: 2, max_players: 4, runtime_minutes: 45 });
    const { unmount } = renderWithProviders(<ItemCard item={item} />, { language: "de" });
    expect(screen.getByText("Brettspiele")).toBeInTheDocument();
    expect(screen.getByText("2-4 Spieler")).toBeInTheDocument();
    expect(screen.getByText("Verfügbar")).toBeInTheDocument();
    unmount();

    renderWithProviders(<ItemCard item={item} />, { language: "pl" });
    expect(screen.getByText("Gry planszowe")).toBeInTheDocument();
    expect(screen.getByText("2-4 Graczy")).toBeInTheDocument();
    expect(screen.getByText("Dostępne")).toBeInTheDocument();
  });

  it("opens the editor when the card is clicked", () => {
    const onEdit = vi.fn();
    renderWithProviders(<ItemCard item={makeItem()} onEdit={onEdit} />);
    fireEvent.click(screen.getByRole("heading", { name: "Dune" }));
    expect(onEdit).toHaveBeenCalledTimes(1);
  });

  it("renders the lend and return buttons only for the matching state", () => {
    const onLend = vi.fn();
    const onReturn = vi.fn();
    const { unmount } = renderWithProviders(
      <ItemCard item={makeItem()} onLend={onLend} onReturn={onReturn} />
    );
    fireEvent.click(screen.getByRole("button", { name: "Lend Item" }));
    expect(onLend).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("button", { name: "Mark as Returned" })).toBeNull();
    unmount();

    renderWithProviders(
      <ItemCard item={makeItem({ status: "LENT_OUT" })} onLend={onLend} onReturn={onReturn} />
    );
    fireEvent.click(screen.getByRole("button", { name: "Mark as Returned" }));
    expect(onReturn).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("button", { name: "Lend Item" })).toBeNull();
  });
});

describe("CatalogGrid", () => {
  const baseProps = { items: [], isLoading: false, locationsMap: new Map<string, string>() };

  it("shows a localized error state instead of a hardcoded English title", () => {
    renderWithProviders(<CatalogGrid {...baseProps} isError />, { language: "de" });
    expect(screen.getByText("Katalog konnte nicht geladen werden")).toBeInTheDocument();
  });

  it("shows the empty state", () => {
    renderWithProviders(<CatalogGrid {...baseProps} />);
    expect(screen.getByText("No media items found.")).toBeInTheDocument();
  });

  it("renders every item with its location name", () => {
    renderWithProviders(
      <CatalogGrid
        {...baseProps}
        items={[makeItem({ id: "a", title: "Dune", location_id: "loc-1" }), makeItem({ id: "b", title: "Emma" })]}
        locationsMap={new Map([["loc-1", "Living Room"]])}
      />
    );
    expect(screen.getByText("Dune")).toBeInTheDocument();
    expect(screen.getByText("Emma")).toBeInTheDocument();
    expect(screen.getByText("Living Room")).toBeInTheDocument();
  });
});

describe("CatalogPager", () => {
  const props = {
    shown: 48,
    total: 120,
    hasMore: true,
    isLoadingMore: false,
    isLoadMoreError: false,
    onLoadMore: vi.fn(),
  };

  it("shows progress and loads the next page", () => {
    const onLoadMore = vi.fn();
    renderWithProviders(<CatalogPager {...props} onLoadMore={onLoadMore} />);
    expect(screen.getByText("Showing 48 of 120")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Load more" }));
    expect(onLoadMore).toHaveBeenCalledTimes(1);
  });

  it("hides the button once everything is loaded", () => {
    renderWithProviders(<CatalogPager {...props} shown={120} hasMore={false} />);
    expect(screen.getByText("Showing 120 of 120")).toBeInTheDocument();
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("disables the button while loading and reports a failed page", () => {
    renderWithProviders(<CatalogPager {...props} isLoadingMore isLoadMoreError />, { language: "pl" });
    expect(screen.getByRole("button", { name: "Ładowanie kolejnych pozycji..." })).toBeDisabled();
    expect(screen.getByRole("alert")).toHaveTextContent("Nie udało się załadować kolejnych pozycji");
  });

  it("renders nothing for an empty catalog", () => {
    const { container } = renderWithProviders(<CatalogPager {...props} shown={0} total={0} hasMore={false} />);
    expect(container).toBeEmptyDOMElement();
  });
});

describe("CatalogFilterBar", () => {
  const props = {
    category: "ALL" as const,
    setCategory: vi.fn(),
    query: "dune",
    setQuery: vi.fn(),
    isCookbook: false,
    setIsCookbook: vi.fn(),
    activeProvidersOnly: false,
    setActiveProvidersOnly: vi.fn(),
  };

  it("exposes accessible names for the icon-only clear button and the search field", () => {
    renderWithProviders(<CatalogFilterBar {...props} />);
    fireEvent.click(screen.getByRole("button", { name: "Clear search" }));
    expect(props.setQuery).toHaveBeenCalledWith("");
    expect(screen.getByRole("textbox", { name: "Search title, author, keyword..." })).toBeInTheDocument();
  });

  it("switches category and toggles the filters", () => {
    renderWithProviders(<CatalogFilterBar {...props} />);
    fireEvent.click(screen.getByRole("button", { name: "Movies" }));
    expect(props.setCategory).toHaveBeenCalledWith("MOVIE");
    fireEvent.click(screen.getByRole("button", { name: "Cookbooks Only" }));
    expect(props.setIsCookbook).toHaveBeenCalledWith(true);
    fireEvent.click(screen.getByRole("button", { name: "Available on My Providers" }));
    expect(props.setActiveProvidersOnly).toHaveBeenCalledWith(true);
  });
});
