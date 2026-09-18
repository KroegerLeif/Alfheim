import { ReactNode } from 'react';

interface StatusBannerProps {
  kind: 'error' | 'success' | 'info';
  children: ReactNode;
}

const STYLES: Record<StatusBannerProps['kind'], string> = {
  error: 'bg-red-950/40 border-red-800/40 text-red-300',
  success: 'bg-emerald-950/40 border-emerald-800/40 text-emerald-300',
  info: 'bg-[var(--surface-elevated)] border-[var(--border-subtle)] text-[var(--text-muted)]',
};

/** Inline feedback banner; errors are announced to assistive tech. */
export function StatusBanner({ kind, children }: StatusBannerProps) {
  return (
    <div
      role={kind === 'error' ? 'alert' : 'status'}
      className={`p-3.5 rounded-xl text-xs font-mono border ${STYLES[kind]}`}
    >
      {children}
    </div>
  );
}
