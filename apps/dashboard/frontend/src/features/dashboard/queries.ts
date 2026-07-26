import { useQuery } from '@tanstack/react-query';
import { fetchTelemetryMetrics, fetchTelemetryLogs } from '@/shared/api';
import { TelemetryMetrics, TelemetryLogEntry } from '@/shared/types';

export const TELEMETRY_METRICS_QUERY_KEY = ['telemetry', 'metrics'];
export const TELEMETRY_LOGS_QUERY_KEY = ['telemetry', 'logs'];

/**
 * Custom TanStack Query hook to poll real-time system metrics from GET /api/v1/telemetry/metrics.
 */
export function useTelemetryMetrics() {
  return useQuery<TelemetryMetrics>({
    queryKey: TELEMETRY_METRICS_QUERY_KEY,
    queryFn: fetchTelemetryMetrics,
    refetchInterval: 5000,
  });
}

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
