export interface CategoryRead {
  id: string;
  name: string;
  description: string | null;
  is_global: boolean;
  owner_id: string | null;
  home_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface CategoryCreate {
  name: string;
  description?: string | null;
}
