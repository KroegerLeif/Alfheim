import type { Metadata } from "next";
import { getSharedMessages, type Language } from "@alfheim/shared";

const LANGUAGES: readonly string[] = ["en", "de", "pl"];

/**
 * Page metadata in the active locale, read from the shared `Chat.metaTitle` /
 * `Chat.metaDescription` entries. An unknown locale falls back to German, like the
 * shared translation hook.
 */
export function getLocalizedMetadata(locale: string): Metadata {
  const language = (LANGUAGES.includes(locale) ? locale : "de") as Language;
  const { Chat } = getSharedMessages(language) as { Chat: { metaTitle: string; metaDescription: string } };
  return { title: Chat.metaTitle, description: Chat.metaDescription };
}
