import { describe, it, expect } from "vitest";
import { getSharedMessages, type Language } from "@alfheim/shared";
import { getLookupErrorKey } from "@/features/item-dialog/lookupErrors";
import { getMediaTypeLabelKey } from "@/features/catalog/itemSpecs";

const LANGUAGES: Language[] = ["en", "de", "pl"];

function resolve(language: Language, key: string): string | undefined {
  let current: unknown = getSharedMessages(language);
  for (const part of key.split(".")) {
    current = (current as Record<string, unknown> | undefined)?.[part];
  }
  return typeof current === "string" ? current : undefined;
}

/** Keys that are assembled at runtime and therefore invisible to the literal-key scan. */
const dynamicKeys = [
  ...[400, 404, 502, 503, null].map((status) => getLookupErrorKey({ status, code: null, itemCount: null })),
  getLookupErrorKey({ status: 502, code: "lookup_not_configured", itemCount: null }),
  ...["BOOK", "GAME", "MOVIE", "SERIES"].map((type) => getMediaTypeLabelKey(type) as string),
  "library.manuals.uploadError",
  "library.manuals.loadUrlError",
  "library.manuals.deleteError",
];

describe("library dictionary", () => {
  it.each(LANGUAGES)("resolves every dynamically built key in %s", (language) => {
    for (const key of dynamicKeys) {
      expect(resolve(language, key), `${language}: ${key}`).toBeTruthy();
    }
  });

  it("maps every lookup failure to a distinct, actionable message", () => {
    const keys = new Set(dynamicKeys.slice(0, 6));
    expect(keys).toEqual(
      new Set([
        "library.itemDialog.lookupInvalid",
        "library.itemDialog.lookupNoResults",
        "library.itemDialog.lookupUnavailable",
        "library.itemDialog.lookupNotConfigured",
      ])
    );
  });

  it("translates the German and Polish strings instead of copying English", () => {
    const sameAsEnglishAllowed = new Set([
      "library.lending.statusColumn",
      "library.itemDialog.isbn",
      "library.catalog.errorLoadingTitle",
    ]);
    const keys = [
      "library.catalog.loadMore",
      "library.catalog.showing",
      "library.catalog.clearSearch",
      "library.itemDialog.provider",
      "library.itemDialog.lookupNoResults",
      "library.itemDialog.lookupNotConfigured",
      "library.lending.unknownItem",
      "library.lending.noHistory",
      "library.lending.returnError",
      "library.locations.deleteInUse",
      "library.locations.editAria",
      "library.providers.deleteInUse",
      "library.providers.typeBookPass",
      "library.manuals.uploaded",
    ].filter((key) => !sameAsEnglishAllowed.has(key));

    for (const language of ["de", "pl"] as const) {
      for (const key of keys) {
        expect(resolve(language, key), `${language}: ${key}`).not.toBe(resolve("en", key));
      }
    }
  });
});
