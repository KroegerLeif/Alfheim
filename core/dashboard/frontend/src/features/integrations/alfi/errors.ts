import { isApiError } from '@alfheim/shared';

/** i18n key for a failed save or health check of the ALFI model block, by chat's error code. */
export function alfiErrorKey(error: unknown): string {
  if (!isApiError(error)) return 'dashboard.integrations.alfi.error_failed';
  if (error.code === 'invalid_base_url') return 'dashboard.integrations.alfi.error_host';
  if (error.code === 'api_key_required') return 'dashboard.integrations.alfi.error_key_required';
  if (error.status === 403) return 'dashboard.integrations.error_forbidden';
  if (error.status === 422) return 'dashboard.integrations.alfi.error_encryption';
  if (error.status === 400) return 'dashboard.integrations.error_invalid';
  return 'dashboard.integrations.alfi.error_failed';
}
