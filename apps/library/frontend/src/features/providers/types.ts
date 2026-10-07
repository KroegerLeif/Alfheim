/** Provider categories understood by the backend (`provider_type` is a free-form string there). */
export const PROVIDER_TYPES = ["STREAMING", "GAMING_PASS", "BOOK_PASS"] as const;

export type ProviderType = (typeof PROVIDER_TYPES)[number];

/** Mirrors the backend `ProviderResponse` schema. */
export interface ProviderSubscription {
  id: string;
  household_id: string;
  provider_name: string;
  provider_type: string;
  is_active: boolean;
  icon_url?: string | null;
  created_at: string;
  updated_at: string;
}

export interface ProviderCreatePayload {
  provider_name: string;
  provider_type: ProviderType;
  is_active?: boolean;
  icon_url?: string | null;
}

export interface ProviderUpdatePayload {
  provider_name?: string;
  provider_type?: ProviderType;
  is_active?: boolean;
  icon_url?: string | null;
}
