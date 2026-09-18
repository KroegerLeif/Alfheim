/**
 * DTO contracts matching the household backend (core/household/backend) for
 * households, members, invites, contacts and the user profile.
 */

export type HouseholdRole = 'OWNER' | 'ADMIN' | 'MEMBER' | 'GUEST';

export const HOUSEHOLD_ROLES: readonly HouseholdRole[] = ['OWNER', 'ADMIN', 'MEMBER', 'GUEST'];

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
  email?: string;
  username?: string;
  first_name?: string;
  last_name?: string;
  avatar_url?: string;
  role: string;
  joined_at: string;
}

export interface CreateHouseholdRequest {
  name: string;
  slug?: string;
}

export interface Household {
  id: string;
  name: string;
  slug: string;
  owner_id: string;
  street: string;
  zip: string;
  city: string;
  country: string;
  latitude?: number;
  longitude?: number;
  /** The caller's role in this household. */
  role?: string;
  /** Whether this is the caller's default household (from GET /households/me). */
  is_default?: boolean;
  members?: HouseholdMember[];
  created_at: string;
  updated_at: string;
}

export interface ContactCategory {
  id: string;
  household_id: string;
  name: string;
  icon: string;
  color: string;
  created_at: string;
  updated_at: string;
}

export interface Contact {
  id: string;
  household_id: string;
  category_id?: string | null;
  name: string;
  phone: string;
  email: string;
  address: string;
  latitude?: number | null;
  longitude?: number | null;
  description: string;
  links: string[];
  icon?: string;
  avatar_url?: string;
  created_at: string;
  updated_at: string;
}

export interface ContactPayload {
  category_id: string | null;
  name: string;
  phone: string;
  email: string;
  address: string;
  latitude: number | null;
  longitude: number | null;
  description: string;
  links: string[];
  icon: string;
  avatar_url: string;
}

export interface ContactCategoryPayload {
  name: string;
  icon: string;
  color: string;
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
  created_by?: string;
  created_at?: string;
}

export interface JoinHouseholdRequest {
  token: string;
}
