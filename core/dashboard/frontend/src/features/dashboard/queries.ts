import { useQuery } from '@tanstack/react-query';
import { fetchTelemetryLogs, fetchTelemetryMetrics } from '@/shared/api';
import { TelemetryLogEntry, TelemetryMetrics } from '@/shared/types';

export const TELEMETRY_LOGS_QUERY_KEY = ['telemetry', 'logs'];
export const TELEMETRY_METRICS_QUERY_KEY = ['telemetry', 'metrics'];

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
