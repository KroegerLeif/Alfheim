import { describe, it, expect, vi } from 'vitest'
import { formatUptime, runShellCommand, type ShellCommandDeps } from '../shellCommands'

// Echoes the key and its params so assertions see exactly what reached the dictionary.
const t = (key: string, params?: Record<string, string | number>) =>
  params ? `${key} ${JSON.stringify(params)}` : key

function deps(overrides: Partial<ShellCommandDeps> = {}): ShellCommandDeps {
  return {
    fetchAppHealth: vi.fn().mockResolvedValue({ apps: {}, checked_at: '' }),
    fetchTelemetryMetrics: vi.fn().mockResolvedValue({ available: false }),
    now: vi.fn().mockReturnValue(0),
    ...overrides,
  }
}

describe('runShellCommand', () => {
  it('answers help without any request', async () => {
    const d = deps()
    expect(await runShellCommand(' HELP ', t, d)).toEqual({ level: 'SUCCESS', service: 'system', message: 'dashboard.shell_help_response' })
    expect(d.fetchAppHealth).not.toHaveBeenCalled()
  })

  it('reports status from the live app health and warns when an app is down', async () => {
    const d = deps({
      fetchAppHealth: vi.fn().mockResolvedValue({ apps: { pantry: 'online', chat: 'offline', budget: 'degraded' }, checked_at: '' }),
    })
    const res = await runShellCommand('status', t, d)
    expect(res.level).toBe('WARN')
    expect(res.message).toBe('dashboard.shell_status_response {"online":1,"total":3,"degraded":1,"offline":1}')
  })

  it('reports status as OK only when every app is online', async () => {
    const d = deps({ fetchAppHealth: vi.fn().mockResolvedValue({ apps: { pantry: 'online' }, checked_at: '' }) })
    expect((await runShellCommand('status', t, d)).level).toBe('SUCCESS')
  })

  it('lists the probed apps in a stable order', async () => {
    const d = deps({ fetchAppHealth: vi.fn().mockResolvedValue({ apps: { pantry: 'online', chat: 'offline' }, checked_at: '' }) })
    const res = await runShellCommand('apps', t, d)
    expect(res).toEqual({ level: 'WARN', service: 'system', message: 'dashboard.shell_apps_response {"apps":"chat=offline, pantry=online"}' })
  })

  it('lists all-online apps as OK', async () => {
    const d = deps({ fetchAppHealth: vi.fn().mockResolvedValue({ apps: { pantry: 'online' }, checked_at: '' }) })
    expect((await runShellCommand('apps', t, d)).level).toBe('SUCCESS')
  })

  it('says when no app is probed (Lean Core)', async () => {
    expect((await runShellCommand('apps', t, deps())).message).toBe('dashboard.shell_apps_none')
  })

  it('reports the host uptime from the telemetry metrics', async () => {
    const d = deps({ fetchTelemetryMetrics: vi.fn().mockResolvedValue({ available: true, uptime_seconds: 93784 }) })
    expect((await runShellCommand('uptime', t, d)).message).toBe('dashboard.shell_uptime_response {"uptime":"1d 2h 3m"}')
  })

  it('says uptime is unavailable instead of inventing one', async () => {
    const res = await runShellCommand('uptime', t, deps({ fetchTelemetryMetrics: vi.fn().mockResolvedValue({ available: true }) }))
    expect(res).toEqual({ level: 'WARN', service: 'system', message: 'dashboard.shell_uptime_unavailable' })
  })

  it('measures a real round trip for ping', async () => {
    const now = vi.fn().mockReturnValueOnce(100).mockReturnValueOnce(142.6)
    const d = deps({ now })
    const res = await runShellCommand('ping', t, d)
    expect(d.fetchAppHealth).toHaveBeenCalledTimes(1)
    expect(res).toEqual({ level: 'INFO', service: 'network', message: 'dashboard.shell_ping_response {"ms":43}' })
  })

  it('reports a failed request as an error, never as a healthy answer', async () => {
    const d = deps({ fetchAppHealth: vi.fn().mockRejectedValue(new Error('502')) })
    expect(await runShellCommand('status', t, d)).toEqual({
      level: 'ERROR',
      service: 'system',
      message: 'dashboard.shell_command_failed {"cmd":"status"}',
    })
  })

  it('answers an unknown command with a warning', async () => {
    expect(await runShellCommand('rm -rf', t, deps())).toEqual({
      level: 'WARN',
      service: 'shell',
      message: 'dashboard.shell_unknown_response {"cmd":"rm -rf"}',
    })
  })
})

describe('formatUptime', () => {
  it.each([
    [59, '0m'],
    [3600, '1h 0m'],
    [86400, '1d 0h 0m'],
    [90061, '1d 1h 1m'],
  ])('formats %d seconds as %s', (seconds, text) => {
    expect(formatUptime(seconds)).toBe(text)
  })
})
