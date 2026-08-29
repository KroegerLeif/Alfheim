export type ProviderType = "MOVIE" | "GAME" | "BOTH";

export interface ProviderSubscription {
  id: string;
  household_id: string;
  name: string;
  provider_type: ProviderType;
  is_active: boolean;
  notes?: string | null;
  created_at: string;
  updated_at: string;
}

export interface ProviderCreatePayload {
  name: string;
  provider_type: ProviderType;
  is_active?: boolean;
  notes?: string | null;
}

export interface ProviderUpdatePayload {
  name?: string;
  provider_type?: ProviderType;
  is_active?: boolean;
  notes?: string | null;
}
