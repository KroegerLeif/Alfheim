import { api } from '@/core/api/client';
import {
  AppItem,
  DashboardAppsResponse,
  UserPreferences,
  CreateUserLinkRequest,
  TelemetryMetrics,
  TelemetryLogsResponse,
  UserCapabilities,
  AppHealthResponse,
} from './types';

/* 3-Tier Dashboard & Apps API */
export async function fetchDashboardApps(): Promise<DashboardAppsResponse> {
  return await api.get('apps/dashboard').json<DashboardAppsResponse>();
}

export async function fetchUserPreferences(): Promise<UserPreferences> {
  return await api.get('user/preferences').json<UserPreferences>();
}

export async function updateUserPreferences(hiddenAppIds: string[]): Promise<UserPreferences> {
  return await api.put('user/preferences', { hidden_app_ids: hiddenAppIds }).json<UserPreferences>();
}

export async function createUserLink(payload: CreateUserLinkRequest): Promise<AppItem> {
  return await api.post('user/links', payload).json<AppItem>();
}

export async function updateUserLink(id: string, payload: Partial<CreateUserLinkRequest>): Promise<AppItem> {
  return await api.put(`user/links/${id}`, payload).json<AppItem>();
}

export async function deleteUserLink(id: string): Promise<void> {
  await api.delete(`user/links/${id}`);
}

/** Cached live health of the enabled app backends; the browser never probes the apps itself. */
export async function fetchAppHealth(): Promise<AppHealthResponse> {
  return await api.get('apps/health').json<AppHealthResponse>();
}

/* Backward-compatibility wrappers */
export async function fetchAppCatalog(): Promise<DashboardAppsResponse> {
  return fetchDashboardApps();
}

export async function createApp(payload: CreateUserLinkRequest): Promise<AppItem> {
  return createUserLink(payload);
}

export async function updateApp(id: string, payload: Partial<CreateUserLinkRequest>): Promise<AppItem> {
  return updateUserLink(id, payload);
}

/* Telemetry API */
export async function fetchTelemetryMetrics(): Promise<TelemetryMetrics> {
  try {
    return await api.get('telemetry/metrics').json<TelemetryMetrics>();
  } catch {
    return await api.get('telemetry').json<TelemetryMetrics>();
  }
}

export async function fetchTelemetryLogs(): Promise<TelemetryLogsResponse> {
  return await api.get('telemetry/logs').json<TelemetryLogsResponse>();
}

/* Capabilities API */
export async function fetchUserCapabilities(): Promise<UserCapabilities> {
  return await api.get('user/capabilities').json<UserCapabilities>();
}
