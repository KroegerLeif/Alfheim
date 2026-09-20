'use client';

import { useTranslation } from '@alfheim/shared';
import { useTelemetryMetrics } from '../queries';

function StatTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="p-4 rounded-xl bg-[var(--surface-elevated)] border border-[var(--border-subtle)] flex flex-col gap-1.5">
      <span className="text-[10px] font-mono uppercase tracking-widest text-[var(--text-muted)]">{label}</span>
      <span className="text-lg font-bold font-mono text-[var(--text-main)]">{value}</span>
    </div>
  );
}

function formatUptime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return '--';
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

/**
 * Renders live CPU/RAM/network telemetry from GET /api/v1/telemetry/metrics.
 * The backend only reports values it actually sourced from VictoriaMetrics --
 * when metrics are unavailable (VictoriaMetrics unreachable, or reachable but
 * without host-level exporters configured), this widget shows an explicit
 * "unavailable" state instead of guessing or rendering zeros.
 */
export function MetricsWidget() {
  const { t } = useTranslation();
  const { data: metrics, isLoading } = useTelemetryMetrics();

  const hasReadings =
    !!metrics?.available &&
    (metrics.cpu_percent !== undefined ||
      metrics.memory_percent !== undefined ||
      metrics.network_rx_mbps !== undefined ||
      metrics.network_tx_mbps !== undefined);

  return (
    <div className="col-span-12 p-6 rounded-2xl bg-[var(--surface-card)] border border-[var(--border-subtle)]">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h2 className="text-base font-bold text-[var(--text-main)] mb-1">{t('dashboard.telemetry_title')}</h2>
          <p className="text-xs text-[var(--text-muted)]">{t('dashboard.telemetry_subtitle')}</p>
        </div>
        <span
          className={`px-2.5 py-1 rounded-full text-[10px] font-mono font-bold border shrink-0 ${
            hasReadings
              ? 'bg-emerald-950/40 text-emerald-400 border-emerald-800/40'
              : 'bg-amber-950/40 text-amber-400 border-amber-800/40'
          }`}
        >
          {isLoading
            ? t('dashboard.telemetry_syncing')
            : hasReadings
              ? t('dashboard.telemetry_live_stream')
              : t('dashboard.telemetry_unavailable')}
        </span>
      </div>

      {hasReadings && metrics ? (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatTile
            label={t('dashboard.cpu_load')}
            value={metrics.cpu_percent !== undefined ? `${metrics.cpu_percent}%` : '--'}
          />
          <StatTile
            label={t('dashboard.memory_ram')}
            value={
              metrics.memory_used_gb !== undefined && metrics.memory_total_gb !== undefined
                ? `${metrics.memory_used_gb} / ${metrics.memory_total_gb} GB`
                : '--'
            }
          />
          <StatTile
            label={t('dashboard.network_io')}
            value={
              metrics.network_rx_mbps !== undefined && metrics.network_tx_mbps !== undefined
                ? `↓${metrics.network_rx_mbps} / ↑${metrics.network_tx_mbps} Mbps`
                : '--'
            }
          />
          <StatTile label={t('dashboard.uptime')} value={formatUptime(metrics.uptime_seconds)} />
        </div>
      ) : (
        <div className="p-6 rounded-xl bg-[var(--surface-elevated)] border border-dashed border-[var(--border-subtle)] text-center">
          <p className="text-xs font-mono text-[var(--text-muted)]">
            {metrics?.message || t('dashboard.telemetry_unavailable_desc')}
          </p>
        </div>
      )}
    </div>
  );
}
