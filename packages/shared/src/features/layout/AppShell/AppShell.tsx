'use client';

import React from 'react';
import { ErrorBoundary } from '../../ui/components/ErrorBoundary';
import { HouseholdProvider } from '../../household/HouseholdProvider';

export interface AppShellProps {
  header?: React.ReactNode;
  sidebar?: React.ReactNode;
  className?: string;
  children: React.ReactNode;
}

/**
 * Universal AppShell layout wrapper providing full-height container,
 * sticky top header, sidebar navigation slot, and responsive main viewport.
 * Mounts the shared HouseholdProvider so header, sidebar and pages share one
 * active-household context.
 */
export function AppShell({ header, sidebar, className = '', children }: AppShellProps) {
  return (
    <HouseholdProvider>
      <div className={`w-full min-h-screen h-screen flex flex-col bg-[var(--surface-canvas)] text-[var(--text-main)] transition-colors duration-200 ${className}`}>
        {header}
        <div className="flex-1 w-full flex min-w-0 min-h-0 overflow-hidden">
          {sidebar}
          <main className="flex-1 w-full min-w-0 min-h-0 flex flex-col overflow-y-auto">
            <ErrorBoundary>
              {children}
            </ErrorBoundary>
          </main>
        </div>
      </div>
    </HouseholdProvider>
  );
}
