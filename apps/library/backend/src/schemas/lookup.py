"""Pydantic schemas for external metadata lookup responses."""

from pydantic import BaseModel, ConfigDict, Field

from src.db.models import MediaType


class BookLookupResponse(BaseModel):
    """Metadata response schema for book lookups via ISBN."""

    model_config = ConfigDict(from_attributes=True)

    title: str = Field(..., description="Title of the book.")
    media_type: MediaType = Field(default=MediaType.BOOK, description="Media type discriminator.")
    author_creator: str | None = Field(default=None, description="Author or editor of the book.")
    description: str | None = Field(default=None, description="Synopsis or summary of the book.")
    isbn_gtin: str | None = Field(default=None, description="ISBN-10 or ISBN-13 barcode standard.")
    cover_image_url: str | None = Field(default=None, description="URL of cover artwork image.")
    publisher: str | None = Field(default=None, description="Publishing company name.")
    published_date: str | None = Field(default=None, description="Date or year of publication.")


class BoardGameLookupResponse(BaseModel):
    """Metadata response schema for board game lookups via BoardGameGeek."""

    model_config = ConfigDict(from_attributes=True)

    id: str | None = Field(default=None, description="BoardGameGeek ID.")
    title: str = Field(..., description="Name of the board game.")
    media_type: MediaType = Field(default=MediaType.GAME, description="Media type discriminator.")
    author_creator: str | None = Field(default=None, description="Game designer or publisher.")
    description: str | None = Field(default=None, description="Game overview description.")
    min_players: int | None = Field(default=None, ge=1, description="Minimum recommended player count.")
    max_players: int | None = Field(default=None, ge=1, description="Maximum recommended player count.")
    runtime_minutes: int | None = Field(default=None, ge=1, description="Average playing time in minutes.")
    cover_image_url: str | None = Field(default=None, description="URL of game box artwork image.")
    categories: list[str] = Field(default_factory=list, description="Game categories or mechanics.")


class MovieSeriesLookupResponse(BaseModel):
    """Metadata response schema for movie and TV series lookups via TMDB."""

    model_config = ConfigDict(from_attributes=True)

    id: str | None = Field(default=None, description="TMDB entry ID.")
    title: str = Field(..., description="Title of the movie or series.")
    media_type: MediaType = Field(..., description="Media type discriminator (MOVIE or SERIES).")
    author_creator: str | None = Field(default=None, description="Director, creator, or production studio.")
    description: str | None = Field(default=None, description="Plot synopsis overview.")
    runtime_minutes: int | None = Field(default=None, ge=1, description="Runtime per episode or movie duration.")
    fsk_rating: int | None = Field(default=None, ge=0, le=18, description="Age rating classification.")
    cover_image_url: str | None = Field(default=None, description="Poster image URL.")
    release_year: int | None = Field(default=None, description="Year of release.")


class BoardGameLookupListResponse(BaseModel):
    """Wrapper response for multiple board game search results."""

    results: list[BoardGameLookupResponse]
    total: int


class MovieSeriesLookupListResponse(BaseModel):
    """Wrapper response for multiple movie/series search results."""

    results: list[MovieSeriesLookupResponse]
    total: int
