import { pantryClient } from "./api";

/** Page size the Pantry list endpoints use by default and as their upper bound for history. */
const PAGE_SIZE = 100;
/** Safety bound so a misbehaving server can never turn one query into an endless request loop. */
const MAX_PAGES = 50;

/**
 * Reads every page of an offset-paginated list endpoint. The list endpoints default to 100 rows, so a
 * single call silently drops everything beyond that.
 */
export async function fetchAllPages<T>(path: string): Promise<T[]> {
  const rows: T[] = [];
  for (let page = 0; page < MAX_PAGES; page++) {
    const batch = await pantryClient
      .get(path, { searchParams: { limit: PAGE_SIZE, offset: page * PAGE_SIZE } })
      .json<T[]>();
    const items = batch ?? [];
    rows.push(...items);
    if (items.length < PAGE_SIZE) break;
  }
  return rows;
}
