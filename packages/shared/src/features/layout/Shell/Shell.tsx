'use client';

import React from 'react';

export interface ShellProps {
  header?: React.ReactNode;
  sidebar?: React.ReactNode;
  className?: string;
  children: React.ReactNode;
}

export function Shell({ header, sidebar, className = '', children }: ShellProps) {
  return (
    <div className={`min-h-screen bg-[var(--surface-canvas)] text-[var(--text-main)] ${className}`}>
      {header}
      <div className="flex">
        {sidebar}
        <main className="flex-1">{children}</main>
      </div>
    </div>
  );
}
