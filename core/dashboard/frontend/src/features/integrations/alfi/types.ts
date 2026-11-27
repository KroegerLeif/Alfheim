/** Provider presets the ALFI card offers; chat supports more types through its own UI. */
export const ALFI_PROVIDERS = ['ollama', 'openai_compatible'] as const;

export type AlfiProvider = (typeof ALFI_PROVIDERS)[number];

/** Health statuses chat stores after a model block health check. */
export type ModelBlockHealth = 'ok' | 'unreachable' | 'auth_invalid' | 'unknown';

/**
 * A chat model block as chat's public API returns it. It never carries the API key, only
 * `has_api_key`; chat stays the only store of LLM providers (ADR 0010 §5).
 */
export interface ModelBlock {
  id: string;
  display_name: string;
  provider_type: string;
  base_url?: string | null;
  model_identifier: string;
  has_api_key: boolean;
  visibility: 'private' | 'shared';
  household_id?: string | null;
  health_status: ModelBlockHealth | string;
  health_detail?: string | null;
  health_checked_at?: string | null;
}

/** Body of `PUT /api/v1/chat/model-blocks/household-default` (OWNER and ADMIN). */
export interface HouseholdModelBlockUpdate {
  display_name: string;
  provider_type: AlfiProvider;
  base_url: string;
  model_identifier: string;
  /** Write-only; omit to keep the stored key. */
  api_key?: string;
  clear_api_key?: boolean;
}
