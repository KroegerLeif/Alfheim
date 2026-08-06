export interface LocationRead {
  id: string;
  name: string;
  description: string | null;
  is_system: boolean;
  owner_id: string | null;
  home_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface LocationCreate {
  name: string;
  description?: string | null;
}
