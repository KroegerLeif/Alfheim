/**
 * DTO contracts matching Go backend models for the apps and telemetry services.
 * Household, profile and contact DTOs live in core/household.
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
