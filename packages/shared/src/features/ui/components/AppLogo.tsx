'use client';

import React from 'react';
import { AlfheimLogo } from './AlfheimLogo';
import { APP_GLYPH_ICONS } from '../../../assets/appGlyphs';

export type AppIdentifier = 'shopping' | 'pantry' | 'maintenance' | 'chores' | 'dashboard' | string;

export interface AppLogoProps {
  appName?: AppIdentifier;
  size?: number;
  className?: string;
  variant?: 'mark' | 'badge' | 'full';
  customIcon?: React.ReactNode;
}

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
  const Glyph = appName ? APP_GLYPH_ICONS[appName.toLowerCase()] : undefined;
  const icon =
    customIcon || (Glyph ? <Glyph aria-hidden="true" strokeWidth={1.75} className="w-full h-full" /> : null);

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
