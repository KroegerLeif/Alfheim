'use client';

import { useState, useEffect } from 'react';
import { useTranslation } from '@loeger-os/shared';
import { useTelemetryMetrics } from '../queries';
import { TelemetryMetrics } from '@/shared/types';

/**
 * System Health Telemetry Widget.
 * Renders dynamic CPU, RAM, Network I/O, and Uptime Bento cards with live SigNoz / backend telemetry.
 * Styled with high contrast and explicit layout boundaries for Obsidian Flux & Kinetic themes.
 */
export function SystemHealthWidget() {
  const { t } = useTranslation();
  const { data: serverTelemetry, isLoading, isError } = useTelemetryMetrics();
  const [isCollapsed, setIsCollapsed] = useState(false);

  // Live telemetry fallback state for updates when server telemetry is syncing
  const [metrics, setMetrics] = useState<TelemetryMetrics>({
    cpu_percent: 14.2,
    memory_percent: 42.8,
    memory_used_gb: 6.8,
    memory_total_gb: 16.0,
    network_rx_mbps: 2.4,
    network_tx_mbps: 1.8,
    uptime_seconds: 432100,
    active_containers: 6,
  });

  useEffect(() => {
    if (serverTelemetry) {
      setMetrics(serverTelemetry);
    }
  }, [serverTelemetry]);

  const formatUptime = (seconds: number) => {
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    return `${days}d ${hours}h ${mins}m`;
  };

  const getGaugeColorClass = (percent: number) => {
    if (percent > 85) return 'bg-red-500 shadow-[0_0_10px_rgba(239,68,68,0.6)]';
    if (percent > 70) return 'bg-amber-400 shadow-[0_0_10px_rgba(251,191,36,0.6)]';
    return 'bg-[var(--primary-main)] shadow-[0_0_10px_var(--primary-main)]';
  };

  return (
    <div className="col-span-12 p-5 sm:p-6 rounded-2xl bg-[var(--surface-card)] border border-[var(--border-subtle)] relative overflow-visible shadow-xl transition-all duration-300">
      {/* Background Ambient Glow */}
      <div className="absolute top-0 right-0 w-80 h-80 bg-[var(--primary-main)]/5 rounded-full blur-3xl pointer-events-none" />

      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4 pb-3 border-b border-[var(--border-subtle)] min-w-0">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-9 h-9 shrink-0 rounded-xl bg-[var(--primary-main)]/10 border border-[var(--border-accent)] flex items-center justify-center text-[var(--primary-main)] shadow-[0_0_12px_var(--accent-glow)]">
            <span className="material-symbols-outlined text-xl">insights</span>
          </div>
          <div className="min-w-0">
            <h2 className="text-base font-bold text-[var(--text-main)] truncate">{t('dashboard.telemetry_title')}</h2>
            <p className="text-xs text-[var(--text-muted)] font-mono truncate">
              {t('dashboard.telemetry_subtitle')}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <div className="flex items-center gap-2 px-2.5 py-1 rounded-full bg-[var(--surface-canvas)] border border-[var(--border-subtle)]">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[var(--primary-main)] opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-[var(--primary-main)]"></span>
            </span>
            <span className="text-[10px] font-bold font-mono tracking-wider text-[var(--primary-main)] uppercase">
              {isLoading ? t('dashboard.telemetry_syncing') : isError ? t('dashboard.telemetry_procs_fallback') : t('dashboard.telemetry_live_stream')}
            </span>
          </div>

          <button
            onClick={() => setIsCollapsed(!isCollapsed)}
            type="button"
            className="p-1 rounded-lg bg-[var(--surface-canvas)] border border-[var(--border-subtle)] text-[var(--text-muted)] hover:text-[var(--text-main)] transition-colors cursor-pointer"
            title={isCollapsed ? t('dashboard.expand_telemetry') : t('dashboard.collapse_telemetry')}
          >
            <span className="material-symbols-outlined text-base">
              {isCollapsed ? 'unfold_more' : 'unfold_less'}
            </span>
          </button>
        </div>
      </div>

      {/* Bento Metrics Grid */}
      {!isCollapsed && (
        <>
          {isError && (
            <div className="mt-4 p-3.5 rounded-xl bg-amber-950/40 border border-amber-500/30 text-amber-300 text-xs font-mono flex items-center gap-2.5 shadow-md animate-in fade-in duration-200">
              <span className="material-symbols-outlined text-base text-amber-400 shrink-0">warning</span>
              <span>{t('dashboard.telemetry_error_toast')}</span>
            </div>
          )}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5 mt-4">
          {/* CPU Load Gauge */}
          <div className="p-4.5 rounded-xl bg-[var(--surface-canvas)] border border-[var(--border-subtle)] flex flex-col justify-between min-h-[140px] shadow-sm hover:border-[var(--border-accent)] transition-all duration-200 group">
            <div className="flex items-center justify-between text-xs text-[var(--text-muted)] font-mono mb-2">
              <span className="font-semibold tracking-wider uppercase">{t('dashboard.cpu_load')}</span>
              <span className="material-symbols-outlined text-base text-[var(--primary-main)] group-hover:scale-110 transition-transform">
                memory
              </span>
            </div>
            <div className="flex items-baseline justify-between mb-2">
              <span className="text-2xl sm:text-3xl font-bold font-mono text-[var(--text-main)] tracking-tight">
                {metrics.cpu_percent}%
              </span>
              <span className="text-[10px] font-mono text-[var(--text-muted)]">
                {metrics.cpu_percent > 85 ? t('dashboard.high_load') : t('dashboard.normal_load')}
              </span>
            </div>
            <div className="w-full bg-[var(--surface-elevated)] h-2.5 rounded-full overflow-hidden p-0.5 border border-[var(--border-subtle)]">
              <div
                className={`h-full transition-all duration-500 rounded-full ${getGaugeColorClass(metrics.cpu_percent)}`}
                style={{ width: `${Math.min(metrics.cpu_percent, 100)}%` }}
              />
            </div>
          </div>

          {/* RAM Usage Gauge */}
          <div className="p-4.5 rounded-xl bg-[var(--surface-canvas)] border border-[var(--border-subtle)] flex flex-col justify-between min-h-[140px] shadow-sm hover:border-[var(--border-accent)] transition-all duration-200 group">
            <div className="flex items-center justify-between text-xs text-[var(--text-muted)] font-mono mb-2">
              <span className="font-semibold tracking-wider uppercase">{t('dashboard.memory_ram')}</span>
              <span className="material-symbols-outlined text-base text-[var(--primary-main)] group-hover:scale-110 transition-transform">
                storage
              </span>
            </div>
            <div>
              <div className="text-2xl sm:text-3xl font-bold font-mono text-[var(--text-main)] tracking-tight mb-1">
                {metrics.memory_percent}%
              </div>
              <div className="text-[10px] font-mono text-[var(--text-muted)] truncate mb-2">
                {metrics.memory_used_gb} GB / {metrics.memory_total_gb} GB
              </div>
            </div>
            <div className="w-full bg-[var(--surface-elevated)] h-2.5 rounded-full overflow-hidden p-0.5 border border-[var(--border-subtle)]">
              <div
                className={`h-full transition-all duration-500 rounded-full ${getGaugeColorClass(metrics.memory_percent)}`}
                style={{ width: `${Math.min(metrics.memory_percent, 100)}%` }}
              />
            </div>
          </div>

          {/* Network I/O Gauge */}
          <div className="p-4.5 rounded-xl bg-[var(--surface-canvas)] border border-[var(--border-subtle)] flex flex-col justify-between min-h-[140px] shadow-sm hover:border-[var(--border-accent)] transition-all duration-200 group">
            <div className="flex items-center justify-between text-xs text-[var(--text-muted)] font-mono mb-2">
              <span className="font-semibold tracking-wider uppercase">{t('dashboard.network_io')}</span>
              <span className="material-symbols-outlined text-base text-[var(--primary-main)] group-hover:scale-110 transition-transform">
                swap_vert
              </span>
            </div>
            <div className="space-y-1.5 font-mono">
              <div className="flex items-center justify-between text-sm">
                <span className="text-[var(--text-muted)] text-xs flex items-center gap-1">
                  <span className="material-symbols-outlined text-xs text-emerald-400">arrow_downward</span> RX
                </span>
                <span className="font-bold text-[var(--text-main)]">{metrics.network_rx_mbps} <span className="text-[10px] font-normal text-[var(--text-muted)]">MB/s</span></span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-[var(--text-muted)] text-xs flex items-center gap-1">
                  <span className="material-symbols-outlined text-xs text-sky-400">arrow_upward</span> TX
                </span>
                <span className="font-bold text-[var(--text-main)]">{metrics.network_tx_mbps} <span className="text-[10px] font-normal text-[var(--text-muted)]">MB/s</span></span>
              </div>
            </div>
            <div className="pt-2 border-t border-[var(--border-subtle)] flex items-center justify-between text-[10px] font-mono text-[var(--text-muted)]">
              <span>{t('dashboard.traffic_mode')}</span>
              <span className="text-emerald-400 font-semibold uppercase">{t('dashboard.optimal')}</span>
            </div>
          </div>

          {/* System Uptime Card */}
          <div className="p-4.5 rounded-xl bg-[var(--surface-canvas)] border border-[var(--border-subtle)] flex flex-col justify-between min-h-[140px] shadow-sm hover:border-[var(--border-accent)] transition-all duration-200 group">
            <div className="flex items-center justify-between text-xs text-[var(--text-muted)] font-mono mb-2">
              <span className="font-semibold tracking-wider uppercase">{t('dashboard.uptime')}</span>
              <span className="material-symbols-outlined text-base text-[var(--primary-main)] group-hover:scale-110 transition-transform">
                schedule
              </span>
            </div>
            <div className="text-xl sm:text-2xl font-bold font-mono text-[var(--text-main)] tracking-tight truncate my-1">
              {formatUptime(metrics.uptime_seconds)}
            </div>
            <div className="text-xs font-mono text-emerald-400 font-semibold flex items-center gap-2 pt-2 border-t border-[var(--border-subtle)] truncate">
              <span className="w-2 h-2 rounded-full bg-emerald-400 shrink-0 animate-pulse shadow-[0_0_6px_rgba(52,211,153,0.8)]" />
              <span>{t('dashboard.containers_online', { count: metrics.active_containers })}</span>
            </div>
          </div>
        </div>
        </>
      )}
    </div>
  );
}

