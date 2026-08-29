export type ModelBlockVisibility = "private" | "shared";
export type ModelBlockHealthStatus = "ok" | "unreachable" | "auth_invalid" | "unknown";

export interface ModelBlock {
  id: string;
  owner_user_id: string;
  household_id?: string;
  visibility: ModelBlockVisibility;
  provider_type: string;
  display_name: string;
  base_url?: string;
  model_identifier: string;
  has_api_key: boolean;
  config: Record<string, unknown>;
  health_status: ModelBlockHealthStatus;
  health_checked_at?: string;
  health_detail?: string;
  is_bootstrap: boolean;
  is_owner: boolean;
  created_at: string;
  updated_at: string;
}

export interface CreateModelBlockRequest {
  display_name: string;
  provider_type: string;
  model_identifier: string;
  base_url?: string;
  api_key?: string;
  visibility: ModelBlockVisibility;
}

export interface UpdateModelBlockRequest {
  display_name?: string;
  model_identifier?: string;
  base_url?: string;
  api_key?: string;
  visibility?: ModelBlockVisibility;
}

export interface DiscoverModelsRequest {
  provider_type: string;
  base_url?: string;
  api_key?: string;
}

export interface DiscoverModelsResponse {
  models: string[];
}
