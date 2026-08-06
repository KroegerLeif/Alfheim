import { api } from '@/core/api/client';
import {
  AppCatalogResponse,
  AppItem,
  CreateAppRequest,
  UserProfile,
  UpdateProfileRequest,
  TelemetryMetrics,
  TelemetryLogEntry,
  TelemetryLogsResponse,
} from './types';

/* App Catalog API */
export async function fetchAppCatalog(): Promise<AppCatalogResponse> {
  return await api.get('api/v1/apps').json<AppCatalogResponse>();
}

export async function createApp(payload: CreateAppRequest): Promise<AppItem> {
  return await api.post('api/v1/apps', { json: payload }).json<AppItem>();
}

export async function updateApp(id: string, payload: Partial<CreateAppRequest>): Promise<AppItem> {
  return await api.put(`api/v1/apps/${id}`, { json: payload }).json<AppItem>();
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
    // Attempt backward compatibility endpoint
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
