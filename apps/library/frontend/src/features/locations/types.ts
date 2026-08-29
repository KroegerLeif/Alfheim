export interface LocationResponse {
  id: string;
  household_id: string;
  name: string;
  description?: string | null;
  parent_id?: string | null;
  created_at: string;
  updated_at: string;
}

export interface LocationNode extends LocationResponse {
  children: LocationNode[];
  itemCount?: number;
}

export interface LocationCreatePayload {
  name: string;
  description?: string | null;
  parent_id?: string | null;
}

export interface LocationUpdatePayload {
  name?: string;
  description?: string | null;
  parent_id?: string | null;
}
