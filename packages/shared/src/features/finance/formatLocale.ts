/** Intl locale used for money formatting, keyed by the active UI language. */
const INTL_LOCALE_BY_LANGUAGE: Record<string, string> = {
  de: "de-DE",
  en: "en-GB",
  pl: "pl-PL",
};

export function intlLocaleFor(language: string): string {
  return INTL_LOCALE_BY_LANGUAGE[language] ?? "de-DE";
}

/** Symbol Intl uses for a currency code in a locale (e.g. EUR in de-DE is the euro sign). */
export function currencySymbolFor(currency: string, locale: string): string {
  try {
    const part = new Intl.NumberFormat(locale, { style: "currency", currency })
      .formatToParts(0)
      .find((p) => p.type === "currency");
    return part?.value ?? currency;
  } catch {
    return currency;
  }
}
