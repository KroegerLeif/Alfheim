'use client';

import React from 'react';
import { AlfheimLogo } from './AlfheimLogo';

export type AppIdentifier = 'shopping' | 'pantry' | 'maintenance' | 'chores' | 'dashboard' | string;

export interface AppLogoProps {
  appName?: AppIdentifier;
  size?: number;
  className?: string;
  variant?: 'mark' | 'badge' | 'full';
  customIcon?: React.ReactNode;
}

const APP_GLYPHS: Record<string, React.ReactNode> = {
  shopping: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className="w-full h-full">
      <path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z"/>
      <path d="M3 6h18"/>
      <path d="M16 10a4 4 0 0 1-8 0"/>
    </svg>
  ),
  pantry: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className="w-full h-full">
      <path d="M21 8v13H3V8"/>
      <path d="M1 3h22v5H1z"/>
      <path d="M10 12h4"/>
    </svg>
  ),
  maintenance: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className="w-full h-full">
      <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/>
    </svg>
  ),
  chores: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className="w-full h-full">
      <path d="m9 11 3 3L22 4"/>
      <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>
    </svg>
  ),
  dashboard: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className="w-full h-full">
      <rect width="7" height="9" x="3" y="3" rx="1"/>
      <rect width="7" height="5" x="14" y="3" rx="1"/>
      <rect width="7" height="9" x="14" y="12" rx="1"/>
      <rect width="7" height="5" x="3" y="16" rx="1"/>
    </svg>
  ),
};

/**
 * Reusable AppLogo component.
 * Attempts to render app-specific brand badge and falls back to Alfheim line-art logo.
 */
export function AppLogo({
  appName,
  size = 32,
  className = '',
  variant = 'badge',
  customIcon,
}: AppLogoProps) {
  const icon = customIcon || (appName ? APP_GLYPHS[appName.toLowerCase()] : null);

  if (!icon) {
    return <AlfheimLogo size={size} className={className} />;
  }

  if (variant === 'mark') {
    return (
      <div
        className={`flex items-center justify-center text-[var(--primary-main)] ${className}`}
        style={{ width: size, height: size }}
      >
        <div style={{ width: size * 0.7, height: size * 0.7 }}>
          {icon}
        </div>
      </div>
    );
  }

  return (
    <div
      className={`rounded-lg bg-[var(--primary-main)]/10 border border-[var(--border-accent)] flex items-center justify-center text-[var(--primary-main)] shrink-0 shadow-[0_0_12px_var(--accent-glow)] ${className}`}
      style={{ width: size, height: size }}
    >
      <div style={{ width: size * 0.55, height: size * 0.55 }}>
        {icon}
      </div>
    </div>
  );
}

export const AppHeaderLogo = AppLogo;
