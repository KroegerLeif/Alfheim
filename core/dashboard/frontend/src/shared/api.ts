import { api } from '@/core/api/client';
import {
  AppItem,
  DashboardAppsResponse,
  UserPreferences,
  CreateUserLinkRequest,
  UserProfile,
  UpdateProfileRequest,
  TelemetryMetrics,
  TelemetryLogEntry,
  TelemetryLogsResponse,
} from './types';

/* 3-Tier Dashboard & Apps API */
export async function fetchDashboardApps(): Promise<DashboardAppsResponse> {
  return await api.get('api/v1/apps/dashboard').json<DashboardAppsResponse>();
}

export async function fetchUserPreferences(): Promise<UserPreferences> {
  return await api.get('api/v1/user/preferences').json<UserPreferences>();
}

export async function updateUserPreferences(hiddenAppIds: string[]): Promise<UserPreferences> {
  return await api.put('api/v1/user/preferences', { json: { hidden_app_ids: hiddenAppIds } }).json<UserPreferences>();
}

export async function createUserLink(payload: CreateUserLinkRequest): Promise<AppItem> {
  return await api.post('api/v1/user/links', { json: payload }).json<AppItem>();
}

export async function updateUserLink(id: string, payload: Partial<CreateUserLinkRequest>): Promise<AppItem> {
  return await api.put(`api/v1/user/links/${id}`, { json: payload }).json<AppItem>();
}

export async function deleteUserLink(id: string): Promise<void> {
  await api.delete(`api/v1/user/links/${id}`);
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

/* User Profile API */
export async function fetchUserProfile(): Promise<UserProfile> {
  return await api.get('api/v1/profile/me').json<UserProfile>();
}

export async function updateUserProfile(payload: UpdateProfileRequest): Promise<UserProfile> {
  return await api.put('api/v1/profile/me', { json: payload }).json<UserProfile>();
}

/* Telemetry API */
export async function fetchTelemetryMetrics(): Promise<TelemetryMetrics> {
  try {
    return await api.get('api/v1/telemetry/metrics').json<TelemetryMetrics>();
  } catch {
    return await api.get('api/v1/telemetry').json<TelemetryMetrics>();
  }
}

export async function fetchTelemetryLogs(): Promise<TelemetryLogEntry[]> {
  try {
    const res = await api.get('api/v1/telemetry/logs').json<TelemetryLogsResponse>();
    return res.logs;
  } catch {
    return [];
  }
}
