'use client';

import { RefObject } from 'react';

export interface LogEntry {
  id: string;
  timestamp: string;
  level: 'INFO' | 'WARN' | 'ERROR' | 'SUCCESS' | string;
  service: string;
  message: string;
}

interface SystemShellLogsOutputProps {
  logs: LogEntry[];
  logsEndRef: RefObject<HTMLDivElement | null>;
  getLevelBadge: (level: LogEntry['level']) => React.ReactNode;
}

export function SystemShellLogsOutput({
  logs,
  logsEndRef,
  getLevelBadge,
}: SystemShellLogsOutputProps) {
  return (
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
  );
}
