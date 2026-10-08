import type { Metadata } from "next";
import { getSharedMessages, type Language } from "@alfheim/shared";

const LANGUAGES: readonly string[] = ["en", "de", "pl"];

/**
 * Page metadata in the active locale, read from the shared `pantry.title` / `pantry.subtitle`
 * dictionary entries. An unknown locale falls back to German, like the shared translation hook.
 */
export function getLocalizedMetadata(locale: string): Metadata {
  const language = (LANGUAGES.includes(locale) ? locale : "de") as Language;
  const { pantry } = getSharedMessages(language) as { pantry: { title: string; subtitle: string } };
  return { title: pantry.title, description: pantry.subtitle };
}
