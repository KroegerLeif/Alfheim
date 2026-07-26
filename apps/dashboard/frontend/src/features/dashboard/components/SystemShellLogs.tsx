'use client';

import { useState, useEffect, useRef } from 'react';

interface LogEntry {
  id: string;
  timestamp: string;
  level: 'INFO' | 'WARN' | 'ERROR' | 'SUCCESS';
  service: string;
  message: string;
}

const INITIAL_LOGS: LogEntry[] = [
  {
    id: 'log-1',
    timestamp: '23:40:01.102',
    level: 'INFO',
    service: 'gateway',
    message: 'Nginx edge proxy listening on 0.0.0.0:80 [loeger-os.local]',
  },
  {
    id: 'log-2',
    timestamp: '23:40:02.340',
    level: 'SUCCESS',
    service: 'keycloak',
    message: 'Identity realm "loeger-os" initialized with OIDC discovery enabled',
  },
  {
    id: 'log-3',
    timestamp: '23:40:03.891',
    level: 'INFO',
    service: 'pantry-backend',
    message: 'FastAPI service connected to PostgreSQL database (pool_size=10)',
  },
  {
    id: 'log-4',
    timestamp: '23:40:05.120',
    level: 'INFO',
    service: 'dashboard-go',
    message: 'Go Fiber HTTP handler listening on :8080 (App Catalog ready)',
  },
  {
    id: 'log-5',
    timestamp: '23:40:07.450',
    level: 'WARN',
    service: 'telemetry',
    message: 'SigNoz collector running in fallback local simulation mode',
  },
];

/**
 * Live System Shell / Terminal Log Feed component.
 * Repaired contrast, crisp level badges (ERR, WARN, OK, INFO), and zero visual clutter.
 */
export function SystemShellLogs() {
  const [logs, setLogs] = useState<LogEntry[]>(INITIAL_LOGS);
  const [commandInput, setCommandInput] = useState('');
  const [, setCommandHistory] = useState<string[]>([]);
  const logsEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom on new log entries
  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  // Periodic log stream generator
  useEffect(() => {
    const services = ['gateway', 'pantry-backend', 'dashboard-go', 'auth-keycloak', 'telemetry'];
    const messages = [
      'GET /api/v1/apps 200 OK (3ms)',
      'Token validation succeeded for sub=usr-101',
      'Heartbeat check: status=healthy load=0.14',
      'GET /api/v1/profile/me 200 OK (5ms)',
      'Database connection pool health check OK',
    ];

    const interval = setInterval(() => {
      const now = new Date();
      const timestamp = `${now.toTimeString().split(' ')[0]}.${now.getMilliseconds().toString().padStart(3, '0')}`;
      const randomService = services[Math.floor(Math.random() * services.length)];
      const randomMsg = messages[Math.floor(Math.random() * messages.length)];

      const newLog: LogEntry = {
        id: `log-${Date.now()}`,
        timestamp,
        level: 'INFO',
        service: randomService,
        message: randomMsg,
      };

      setLogs((prev) => [...prev.slice(-30), newLog]);
    }, 4000);

    return () => clearInterval(interval);
  }, []);

  const handleCommandSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cmd = commandInput.trim();
    if (!cmd) return;

    const now = new Date();
    const timestamp = `${now.toTimeString().split(' ')[0]}.${now.getMilliseconds().toString().padStart(3, '0')}`;

    // Append executed command log
    const cmdLog: LogEntry = {
      id: `log-${Date.now()}`,
      timestamp,
      level: 'INFO',
      service: 'shell',
      message: `$ ${cmd}`,
    };

    let responseLog: LogEntry | null = null;
    const lower = cmd.toLowerCase();

    if (lower === 'clear') {
      setLogs([]);
      setCommandInput('');
      return;
    } else if (lower === 'help') {
      responseLog = {
        id: `log-res-${Date.now()}`,
        timestamp,
        level: 'SUCCESS',
        service: 'system',
        message: 'Available commands: help, status, apps, clear, ping, uptime',
      };
    } else if (lower === 'status') {
      responseLog = {
        id: `log-res-${Date.now()}`,
        timestamp,
        level: 'SUCCESS',
        service: 'system',
        message: 'Loeger OS Platform: 6/6 Containers Healthy. All proxy routes bound.',
      };
    } else if (lower === 'ping') {
      responseLog = {
        id: `log-res-${Date.now()}`,
        timestamp,
        level: 'INFO',
        service: 'network',
        message: 'pong (latency: 1.2ms)',
      };
    } else {
      responseLog = {
        id: `log-res-${Date.now()}`,
        timestamp,
        level: 'WARN',
        service: 'shell',
        message: `Command "${cmd}" executed. Type "help" for available commands.`,
      };
    }

    setLogs((prev) => [...prev, cmdLog, responseLog]);
    setCommandHistory((prev) => [...prev, cmd]);
    setCommandInput('');
  };

  const getLevelBadge = (level: LogEntry['level']) => {
    switch (level) {
      case 'ERROR':
        return (
          <span className="px-1.5 py-0.5 rounded bg-red-500/20 text-red-400 font-mono text-[9px] font-bold border border-red-500/40 tracking-wider">
            ERR
          </span>
        );
      case 'WARN':
        return (
          <span className="px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 font-mono text-[9px] font-bold border border-amber-500/40 tracking-wider">
            WARN
          </span>
        );
      case 'SUCCESS':
        return (
          <span className="px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-mono text-[9px] font-bold border border-emerald-500/40 tracking-wider">
            OK
          </span>
        );
      default:
        return (
          <span className="px-1.5 py-0.5 rounded bg-[var(--primary-main)]/20 text-[var(--primary-main)] font-mono text-[9px] font-bold border border-[var(--border-accent)] tracking-wider">
            INFO
          </span>
        );
    }
  };

  return (
    <div className="col-span-12 rounded-2xl bg-[var(--surface-canvas)] border border-[var(--border-subtle)] overflow-hidden shadow-2xl flex flex-col font-mono text-xs">
      {/* Terminal Bar Header */}
      <div className="h-10 px-4 bg-[var(--surface-card)] border-b border-[var(--border-subtle)] flex items-center justify-between select-none shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <div className="flex items-center gap-1.5 shrink-0">
            <div className="w-3 h-3 rounded-full bg-red-500/80" />
            <div className="w-3 h-3 rounded-full bg-amber-500/80" />
            <div className="w-3 h-3 rounded-full bg-emerald-500/80" />
          </div>
          <span className="ml-2 text-xs font-mono text-[var(--text-muted)] truncate">
            shell@loeger-os:~# live-telemetry-feed
          </span>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => setLogs([])}
            className="text-[10px] font-mono text-[var(--text-muted)] hover:text-[var(--text-main)] px-2.5 py-1 rounded bg-[var(--surface-elevated)] border border-[var(--border-subtle)] hover:border-[var(--primary-main)]/50 transition-colors duration-150 cursor-pointer"
          >
            Clear
          </button>
        </div>
      </div>

      {/* Log Output Window */}
      <div className="p-4 h-64 overflow-y-auto space-y-2 bg-[var(--surface-canvas)] scrollbar-thin">
        {logs.map((log) => (
          <div key={log.id} className="flex items-start gap-2.5 leading-relaxed">
            <span className="text-[var(--primary-main)] shrink-0 font-mono text-xs font-semibold opacity-90">
              [{log.timestamp}]
            </span>
            <span className="shrink-0">{getLevelBadge(log.level)}</span>
            <span className="text-[var(--text-muted)] font-mono shrink-0 text-xs">
              [{log.service}]
            </span>
            <span className="text-[var(--text-main)] font-mono break-all text-xs">
              {log.message}
            </span>
          </div>
        ))}
        <div ref={logsEndRef} />
      </div>

      {/* Terminal Command Input Prompt */}
      <form
        onSubmit={handleCommandSubmit}
        className="h-11 px-4 border-t border-[var(--border-subtle)] bg-[var(--surface-card)] flex items-center gap-2.5 shrink-0"
      >
        <span className="text-[var(--primary-main)] font-bold font-mono text-sm select-none">$</span>
        <input
          type="text"
          value={commandInput}
          onChange={(e) => setCommandInput(e.target.value)}
          placeholder="Type command (e.g. status, help, ping, clear)..."
          className="flex-1 bg-transparent border-none outline-none text-xs font-mono text-[var(--text-main)] placeholder-[var(--text-muted)] focus:ring-0"
        />
        <button
          type="submit"
          className="px-3.5 py-1 rounded-lg bg-[var(--primary-main)]/10 hover:bg-[var(--primary-main)]/20 text-[var(--primary-main)] text-[11px] font-mono font-semibold border border-[var(--primary-main)]/30 cursor-pointer transition-colors duration-150 shrink-0"
        >
          EXEC
        </button>
      </form>
    </div>
  );
}
