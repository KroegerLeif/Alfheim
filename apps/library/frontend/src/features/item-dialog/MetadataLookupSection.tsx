"use client";

import React, { useState } from "react";
import { Button, useTranslation } from "@alfheim/shared";
import { lookupBgg, lookupIsbn, lookupTmdb } from "./api/dialogApi";
import {
  BoardGameLookupResponse,
  BookLookupResponse,
  ItemFormData,
  LookupType,
  MovieSeriesLookupResponse,
} from "./types";

interface MetadataLookupSectionProps {
  onAutoFill: (data: Partial<ItemFormData>) => void;
}

export function MetadataLookupSection({ onAutoFill }: MetadataLookupSectionProps) {
  const { t } = useTranslation();
  const [lookupType, setLookupType] = useState<LookupType>("ISBN");
  const [query, setQuery] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [bggResults, setBggResults] = useState<BoardGameLookupResponse[]>([]);
  const [tmdbResults, setTmdbResults] = useState<MovieSeriesLookupResponse[]>([]);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;
    setIsLoading(true);
    setError(null);
    setBggResults([]);
    setTmdbResults([]);

    try {
      if (lookupType === "ISBN") {
        const book: BookLookupResponse = await lookupIsbn(query.trim());
        onAutoFill({
          title: book.title,
          media_type: book.media_type,
          author_creator: book.author_creator || "",
          description: book.description || "",
          isbn_gtin: book.isbn_gtin || query.trim(),
          cover_image_url: book.cover_image_url || "",
        });
      } else if (lookupType === "BGG") {
        const res = await lookupBgg(query.trim());
        setBggResults(res.results);
      } else if (lookupType === "TMDB") {
        const res = await lookupTmdb(query.trim());
        setTmdbResults(res.results);
      }
    } catch {
      setError(t("library.itemDialog.lookupError"));
    } finally {
      setIsLoading(false);
    }
  };

  const handleSelectBgg = (game: BoardGameLookupResponse) => {
    onAutoFill({
      title: game.title,
      media_type: game.media_type,
      author_creator: game.author_creator || "",
      description: game.description || "",
      min_players: game.min_players,
      max_players: game.max_players,
      runtime_minutes: game.runtime_minutes,
      cover_image_url: game.cover_image_url || "",
    });
    setBggResults([]);
  };

  const handleSelectTmdb = (item: MovieSeriesLookupResponse) => {
    onAutoFill({
      title: item.title,
      media_type: item.media_type,
      author_creator: item.author_creator || "",
      description: item.description || "",
      runtime_minutes: item.runtime_minutes,
      fsk_rating: item.fsk_rating,
      cover_image_url: item.cover_image_url || "",
    });
    setTmdbResults([]);
  };

  return (
    <div className="space-y-3 rounded-xl border border-[var(--border-subtle,#334155)] bg-[var(--surface-muted,#0f172a)] p-3">
      <form onSubmit={handleSearch} className="flex flex-col sm:flex-row gap-2">
        <select
          value={lookupType}
          onChange={(e) => setLookupType(e.target.value as LookupType)}
          className="rounded-lg border border-[var(--border-main,#334155)] bg-[var(--surface-card,#1e293b)] px-3 py-1.5 text-xs text-[var(--text-main,#f8fafc)] focus:outline-none focus:ring-1 focus:ring-primary"
        >
          <option value="ISBN">{t("library.itemDialog.lookupIsbnLabel")}</option>
          <option value="BGG">{t("library.itemDialog.lookupBggLabel")}</option>
          <option value="TMDB">{t("library.itemDialog.lookupTmdbLabel")}</option>
        </select>
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t("library.itemDialog.lookupPlaceholder")}
          className="flex-1 rounded-lg border border-[var(--border-main,#334155)] bg-[var(--surface-card,#1e293b)] px-3 py-1.5 text-xs text-[var(--text-main,#f8fafc)] placeholder-[var(--text-muted,#64748b)] focus:outline-none focus:ring-1 focus:ring-primary"
        />
        <Button type="submit" size="sm" disabled={isLoading || !query.trim()}>
          {isLoading ? "..." : t("library.itemDialog.lookupBtn")}
        </Button>
      </form>

      {error && <p className="text-xs text-red-400">{error}</p>}

      {bggResults.length > 0 && (
        <div className="max-h-36 overflow-y-auto space-y-1.5 pt-1">
          {bggResults.map((game, idx) => (
            <div
              key={idx}
              onClick={() => handleSelectBgg(game)}
              className="flex items-center justify-between rounded-lg p-2 bg-[var(--surface-card,#1e293b)] hover:bg-primary/20 cursor-pointer text-xs"
            >
              <div className="flex items-center gap-2">
                {game.cover_image_url && (
                  <img src={game.cover_image_url} alt="" className="h-8 w-8 object-cover rounded" />
                )}
                <span className="font-medium text-[var(--text-main,#f8fafc)]">{game.title}</span>
              </div>
              <span className="text-primary font-semibold">{t("library.itemDialog.autoFill")}</span>
            </div>
          ))}
        </div>
      )}

      {tmdbResults.length > 0 && (
        <div className="max-h-36 overflow-y-auto space-y-1.5 pt-1">
          {tmdbResults.map((item, idx) => (
            <div
              key={idx}
              onClick={() => handleSelectTmdb(item)}
              className="flex items-center justify-between rounded-lg p-2 bg-[var(--surface-card,#1e293b)] hover:bg-primary/20 cursor-pointer text-xs"
            >
              <div className="flex items-center gap-2">
                {item.cover_image_url && (
                  <img src={item.cover_image_url} alt="" className="h-8 w-8 object-cover rounded" />
                )}
                <div>
                  <span className="font-medium text-[var(--text-main,#f8fafc)]">{item.title}</span>
                  <span className="ml-2 text-[10px] text-[var(--text-muted,#94a3b8)]">({item.media_type})</span>
                </div>
              </div>
              <span className="text-primary font-semibold">{t("library.itemDialog.autoFill")}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
