import { useQuery } from '@tanstack/react-query';
import { fetchTelemetryLogs, fetchTelemetryMetrics, fetchUserCapabilities } from '@/shared/api';
import { TelemetryLogEntry, TelemetryMetrics, UserCapabilities } from '@/shared/types';

export const TELEMETRY_LOGS_QUERY_KEY = ['telemetry', 'logs'];
export const TELEMETRY_METRICS_QUERY_KEY = ['telemetry', 'metrics'];
export const CAPABILITIES_QUERY_KEY = ['user', 'capabilities'];

/**
 * Custom TanStack Query hook to poll real-time system logs from GET /api/v1/telemetry/logs.
 */
export function useTelemetryLogs() {
  return useQuery<TelemetryLogEntry[]>({
    queryKey: TELEMETRY_LOGS_QUERY_KEY,
    queryFn: fetchTelemetryLogs,
    refetchInterval: 5000,
  });
}

/**
 * Custom TanStack Query hook to poll system health metrics from GET /api/v1/telemetry/metrics.
 * The response may report `available: false` (or omit individual fields) when
 * VictoriaMetrics has no data -- consumers must render that explicitly rather
 * than treating a missing value as zero.
 */
export function useTelemetryMetrics() {
  return useQuery<TelemetryMetrics>({
    queryKey: TELEMETRY_METRICS_QUERY_KEY,
    queryFn: fetchTelemetryMetrics,
    refetchInterval: 10000,
  });
}

/**
 * Fetches what the signed-in user may do (GET /api/v1/user/capabilities).
 * Used only to hide controls the backend would reject with 403; the backend
 * enforces the same rule on every guarded endpoint.
 */
export function useUserCapabilities() {
  return useQuery<UserCapabilities>({
    queryKey: CAPABILITIES_QUERY_KEY,
    queryFn: fetchUserCapabilities,
    staleTime: 5 * 60 * 1000,
  });
}
