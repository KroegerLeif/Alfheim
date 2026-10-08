import type { LendingRecord } from "../types";

export function makeRecord(overrides: Partial<LendingRecord> = {}): LendingRecord {
  return {
    id: "rec-1",
    household_id: "hh-1",
    item_id: "3fa85f64-5717-4562-b3fc-2c963f66afa6",
    item_title: "Dune",
    contact_name: "Alice",
    status: "LENT_OUT",
    lent_at: "2025-03-01T10:00:00Z",
    due_date: null,
    returned_at: null,
    notes: null,
    created_at: "2025-03-01T10:00:00Z",
    updated_at: "2025-03-01T10:00:00Z",
    ...overrides,
  };
}
