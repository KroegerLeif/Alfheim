import { useQuery } from '@tanstack/react-query';
import { fetchTelemetryLogs } from '@/shared/api';
import { TelemetryLogEntry } from '@/shared/types';

export const TELEMETRY_LOGS_QUERY_KEY = ['telemetry', 'logs'];

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
