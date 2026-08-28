'use client';

import React from 'react';

export interface AppShellProps {
  header?: React.ReactNode;
  sidebar?: React.ReactNode;
  className?: string;
  children: React.ReactNode;
}

/**
 * Universal AppShell layout wrapper providing full-height container,
 * sticky top header, sidebar navigation slot, and responsive main viewport.
 */
export function AppShell({ header, sidebar, className = '', children }: AppShellProps) {
  return (
    <div className={`min-h-screen flex flex-col bg-[var(--surface-canvas)] text-[var(--text-main)] transition-colors duration-200 ${className}`}>
      {header}
      <div className="flex-1 flex min-w-0 overflow-hidden">
        {sidebar}
        <main className="flex-1 min-w-0 flex flex-col overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
