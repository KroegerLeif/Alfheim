import { fetchAppHealth, fetchTelemetryMetrics } from '@/shared/api';
import type { AppHealthResponse, TelemetryMetrics } from '@/shared/types';

/** Translation function of `useTranslation`, narrowed to what the shell needs. */
type Translate = (key: string, params?: Record<string, string | number>) => string;

/** One answer line of the shell; the caller adds the id and timestamp. */
export interface ShellResponse {
  level: 'INFO' | 'WARN' | 'ERROR' | 'SUCCESS';
  service: 'system' | 'network' | 'shell';
  message: string;
}

/** Data sources of the shell commands, injectable for tests. */
export interface ShellCommandDeps {
  fetchAppHealth: () => Promise<AppHealthResponse>;
  fetchTelemetryMetrics: () => Promise<TelemetryMetrics>;
  now: () => number;
}

const defaultDeps: ShellCommandDeps = {
  fetchAppHealth,
  fetchTelemetryMetrics,
  now: () => performance.now(),
};

/** Formats seconds as `3d 4h 12m` (days and hours only when non-zero). */
export function formatUptime(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60) % 60;
  const hours = Math.floor(totalSeconds / 3600) % 24;
  const days = Math.floor(totalSeconds / 86400);
  const parts = [days > 0 ? `${days}d` : '', days > 0 || hours > 0 ? `${hours}h` : '', `${minutes}m`];
  return parts.filter(Boolean).join(' ');
}

async function status(t: Translate, deps: ShellCommandDeps): Promise<ShellResponse> {
  const health = await deps.fetchAppHealth();
  const states = Object.values(health.apps ?? {});
  const online = states.filter((s) => s === 'online').length;
  const degraded = states.filter((s) => s === 'degraded').length;
  const offline = states.filter((s) => s === 'offline').length;
  return {
    level: online === states.length ? 'SUCCESS' : 'WARN',
    service: 'system',
    message: t('dashboard.shell_status_response', { online, total: states.length, degraded, offline }),
  };
}

async function apps(t: Translate, deps: ShellCommandDeps): Promise<ShellResponse> {
  const health = await deps.fetchAppHealth();
  const entries = Object.entries(health.apps ?? {}).sort(([a], [b]) => a.localeCompare(b));
  if (entries.length === 0) {
    return { level: 'INFO', service: 'system', message: t('dashboard.shell_apps_none') };
  }
  return {
    level: entries.every(([, state]) => state === 'online') ? 'SUCCESS' : 'WARN',
    service: 'system',
    message: t('dashboard.shell_apps_response', { apps: entries.map(([id, state]) => `${id}=${state}`).join(', ') }),
  };
}

async function uptime(t: Translate, deps: ShellCommandDeps): Promise<ShellResponse> {
  const metrics = await deps.fetchTelemetryMetrics();
  if (!metrics.available || metrics.uptime_seconds === undefined) {
    return { level: 'WARN', service: 'system', message: t('dashboard.shell_uptime_unavailable') };
  }
  return {
    level: 'INFO',
    service: 'system',
    message: t('dashboard.shell_uptime_response', { uptime: formatUptime(metrics.uptime_seconds) }),
  };
}

async function ping(t: Translate, deps: ShellCommandDeps): Promise<ShellResponse> {
  const started = deps.now();
  await deps.fetchAppHealth();
  const ms = Math.max(0, Math.round(deps.now() - started));
  return { level: 'INFO', service: 'network', message: t('dashboard.shell_ping_response', { ms }) };
}

const COMMANDS: Record<string, (t: Translate, deps: ShellCommandDeps) => Promise<ShellResponse>> = {
  status,
  apps,
  uptime,
  ping,
};

/**
 * Answers a shell command from live data: `status` and `apps` from the dashboard's app health
 * probe, `uptime` from the telemetry metrics and `ping` from a measured round trip to the
 * dashboard backend (#640). A failed request is reported as an error line, never as a made-up
 * healthy answer. `clear` is handled by the caller.
 */
export async function runShellCommand(
  command: string,
  t: Translate,
  deps: ShellCommandDeps = defaultDeps,
): Promise<ShellResponse> {
  const name = command.trim().toLowerCase();
  if (name === 'help') {
    return { level: 'SUCCESS', service: 'system', message: t('dashboard.shell_help_response') };
  }
  const run = COMMANDS[name];
  if (!run) {
    return { level: 'WARN', service: 'shell', message: t('dashboard.shell_unknown_response', { cmd: command.trim() }) };
  }
  try {
    return await run(t, deps);
  } catch {
    return { level: 'ERROR', service: 'system', message: t('dashboard.shell_command_failed', { cmd: name }) };
  }
}
