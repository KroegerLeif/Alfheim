/**
 * DTO contracts matching Go backend models for apps, profile, and household services.
 */

export type TierType = 'core' | 'stack' | 'user';

export interface AppItem {
  id: string;
  slug: string;
  title: string;
  name?: string;
  description: string;
  icon: string;
  icon_url?: string;
  url: string;
  app_url?: string;
  category: 'internal' | 'external' | 'user' | string;
  tier: TierType;
  status?: 'active' | 'in_progress' | 'maintenance' | string;
  is_hidden?: boolean;
  is_custom?: boolean;
  required_roles?: string[];
  display_order?: number;
  created_at?: string;
  updated_at?: string;
}

export interface UserPreferences {
  user_id: string;
  hidden_app_ids: string[];
  created_at?: string;
  updated_at?: string;
}

export interface DashboardAppsResponse {
  core: AppItem[];
  stack: AppItem[];
  user: AppItem[];
  all_core?: AppItem[];
  preferences: UserPreferences;
  total: number;
}

export interface CreateUserLinkRequest {
  title: string;
  url: string;
  icon?: string;
  description?: string;
  category?: string;
}

export type CreateAppRequest = CreateUserLinkRequest;

// Backward-compatibility interface for legacy catalog references
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
  role?: string;
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

export interface TelemetryMetrics {
  cpu_percent: number;
  memory_percent: number;
  memory_used_gb: number;
  memory_total_gb: number;
  network_rx_mbps: number;
  network_tx_mbps: number;
  uptime_seconds: number;
  active_containers: number;
}

export interface TelemetryLogEntry {
  id: string;
  timestamp: string;
  level: 'INFO' | 'WARN' | 'ERROR' | 'SUCCESS' | string;
  service: string;
  message: string;
}

export interface TelemetryLogsResponse {
  logs: TelemetryLogEntry[];
  total: number;
}
