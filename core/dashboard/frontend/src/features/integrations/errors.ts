import { isApiError } from '@alfheim/shared';
import { PLUGIN_HEALTH_STATUSES, type PluginHealthStatus } from './types';

/** i18n key for a failed save or test, by the API's status code. */
export function pluginErrorKey(error: unknown): string {
  if (isApiError(error) && (error.status === 422 || error.status === 400)) return 'dashboard.integrations.error_invalid';
  if (isApiError(error) && error.status === 403) return 'dashboard.integrations.error_forbidden';
  if (isApiError(error) && error.status === 503) return 'dashboard.integrations.error_encryption';
  return 'dashboard.integrations.error_failed';
}

/** A known health status; an unexpected value from a newer backend reads as a generic error. */
export function knownHealthStatus(status: string): PluginHealthStatus {
  return (PLUGIN_HEALTH_STATUSES as readonly string[]).includes(status) ? (status as PluginHealthStatus) : 'error';
}
