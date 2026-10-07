import type { TranslationParams } from "@alfheim/shared";

type TranslateFn = (key: string, params?: TranslationParams) => string;

/**
 * Display name of a plan day: its label, or a numbered, localized fallback when the
 * label is blank. `position` is the 1-based position of the day in the plan.
 */
export function dayDisplayLabel(label: string | null | undefined, position: number, t: TranslateFn): string {
  const trimmed = (label ?? "").trim();
  return trimmed || t("workout.dayFallbackLabel", { number: position });
}
