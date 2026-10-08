/**
 * Unit codes offered by the unit picker, in display order. The codes are what the backend stores
 * (it lower-cases them) and must stay stable; only their labels are localized.
 */
export const UNIT_CODES = ["stk", "g", "kg", "ml", "l", "fl.", "pkg.", "bund", "dose", "pkt."] as const;

export const DEFAULT_UNIT = "stk";

/** Maps a stored unit code to its key in the `Units` message namespace. */
const UNIT_LABEL_KEYS: Record<string, string> = {
  stk: "piece",
  piece: "piece",
  pieces: "piece",
  pcs: "piece",
  item: "piece",
  unit: "piece",
  g: "g",
  kg: "kg",
  ml: "ml",
  l: "l",
  "fl.": "bottle",
  bottle: "bottle",
  "pkg.": "pack",
  pack: "pack",
  bund: "bunch",
  dose: "can",
  can: "can",
  "pkt.": "packet",
  bag: "bag",
  box: "box",
};

type Translate = (key: string) => string;

/**
 * Localized label of a stored unit code. Codes without a translation (units that came in from
 * Pantry, for example) are shown as stored.
 *
 * @param t translator scoped to the `Units` namespace
 */
export function unitLabel(code: string, t: Translate): string {
  const key = UNIT_LABEL_KEYS[code.trim().toLowerCase()];
  return key ? t(key) : code;
}
