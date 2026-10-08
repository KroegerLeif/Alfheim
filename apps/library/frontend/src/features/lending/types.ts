export type LendingStatus = "AVAILABLE" | "LENT_OUT";

export interface LendingRecord {
  id: string;
  household_id: string;
  item_id: string;
  /** Title of the lent item, resolved by the API. */
  item_title?: string | null;
  contact_name: string;
  status: LendingStatus;
  lent_at: string;
  due_date?: string | null;
  returned_at?: string | null;
  notes?: string | null;
  created_at: string;
  updated_at: string;
}

export interface LendItemPayload {
  contact_name: string;
  lent_at?: string | null;
  due_date?: string | null;
  notes?: string | null;
}

export interface ReturnItemPayload {
  returned_at?: string | null;
  notes?: string | null;
}

export interface LendingRecordListResponse {
  records: LendingRecord[];
  total: number;
  skip: number;
  limit: number;
}
