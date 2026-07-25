/**
 * DTO contracts matching Go backend models for apps, profile, and household services.
 */

export interface AppItem {
  id: string;
  name: string;
  slug: string;
  description: string;
  icon_url: string;
  app_url: string;
  category: string;
  required_role: string;
  display_order: number;
}

export interface AppCatalogResponse {
  internal: AppItem[];
  external: AppItem[];
  total: number;
}

export interface UserProfile {
  id: string;
  email: string;
  username: string;
  first_name: string;
  last_name: string;
  avatar_url: string;
  created_at: string;
  updated_at: string;
}

export interface UpdateProfileRequest {
  first_name: string;
  last_name: string;
  avatar_url: string;
}

export interface HouseholdMember {
  household_id: string;
  user_id: string;
  role: string;
  joined_at: string;
}

export interface Household {
  id: string;
  name: string;
  slug: string;
  owner_id: string;
  role?: string;
  members?: HouseholdMember[];
  created_at: string;
  updated_at: string;
}

export interface CreateInviteRequest {
  household_id: string;
  role: string;
  ttl_minutes: number;
  max_uses: number;
}

export interface InviteCodeResponse {
  token: string;
  household_id: string;
  role: string;
  expires_at: string;
  max_uses: number;
  uses: number;
}

export interface JoinHouseholdRequest {
  token: string;
}
