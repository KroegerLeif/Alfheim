import type { Metadata } from "next";
import { getSharedMessages, type Language } from "@alfheim/shared";

const LANGUAGES: readonly string[] = ["en", "de", "pl"];

/**
 * Page metadata in the active locale: the checklist title and the app subtitle from the shared
 * dictionary. An unknown locale falls back to German, like the shared translation hook.
 */
export function getLocalizedMetadata(locale: string): Metadata {
  const language = (LANGUAGES.includes(locale) ? locale : "de") as Language;
  const { Checklist, Navigation } = getSharedMessages(language) as {
    Checklist: { title: string };
    Navigation: { shoppingSubtitle: string };
  };
  return { title: Checklist.title, description: Navigation.shoppingSubtitle };
}
