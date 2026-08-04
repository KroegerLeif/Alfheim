/**
 * DTO contracts matching Go backend models for apps, profile, and household services.
 */

export interface AppItem {
  id: string;
  name: string;
  title?: string;
  slug: string;
  description: string;
  icon_url: string;
  icon?: string;
  app_url: string;
  url?: string;
  category: 'internal' | 'external' | string;
  required_role: string;
  is_external?: boolean;
  status?: 'active' | 'in_progress' | 'maintenance' | string;
  is_default?: boolean;
  display_order: number;
}

export interface CreateAppRequest {
  title: string;
  description?: string;
  icon?: string;
  url: string;
  is_external?: boolean;
  category?: 'internal' | 'external' | string;
  status?: 'active' | 'in_progress' | 'maintenance' | string;
  required_role?: string;
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
