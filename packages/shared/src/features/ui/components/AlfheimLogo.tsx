'use client';

import React from 'react';
import { BRAND_ASSETS } from '../../../assets';

export interface AlfheimLogoProps {
  className?: string;
  size?: number;
  variant?: 'mark' | 'white' | 'full';
  showText?: boolean;
}

/**
 * Official Alfheim Sovereign OS Line-Art Brand Logo Component.
 * Supports icon mark, monochrome white, and full brand lockup variants
 * styled dynamically with Nordic Dark theme tokens.
 */
export const AlfheimLogo: React.FC<AlfheimLogoProps> = ({
  className = '',
  size = 32,
  variant = 'mark',
  showText = false,
}) => {
  // If variant is 'full' or showText is true, render logo mark + typography lockup
  if (variant === 'full' || showText) {
    return (
      <div className={`inline-flex items-center gap-2.5 select-none ${className}`}>
        <div
          className="rounded-lg bg-[var(--primary-main)]/10 border border-[var(--border-accent)] flex items-center justify-center text-[var(--primary-main)] shrink-0 shadow-[0_0_12px_var(--accent-glow)]"
          style={{ width: size, height: size }}
        >
          <svg
            viewBox="0 0 24 24"
            width={size * 0.65}
            height={size * 0.65}
            fill="none"
            stroke="currentColor"
            strokeWidth="1.75"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="text-[var(--primary-main)]"
          >
            <path d="M12 2L3 7v10l9 5 9-5V7l-9-5z" />
            <path d="M12 22V12" />
            <path d="M12 12L3 7" />
            <path d="M12 12l9-5" />
            <circle cx="12" cy="12" r="3" fill="currentColor" fillOpacity="0.2" />
          </svg>
        </div>
        <div className="flex flex-col leading-tight">
          <span className="font-bold text-sm tracking-wider uppercase text-[var(--text-main)] font-sans">
            ALFHEIM
          </span>
          <span className="text-[10px] uppercase font-mono tracking-widest text-[var(--text-muted)]">
            Nordic Dark
          </span>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`rounded-lg bg-[var(--primary-main)]/10 border border-[var(--border-accent)] flex items-center justify-center text-[var(--primary-main)] shrink-0 shadow-[0_0_12px_var(--accent-glow)] ${className}`}
      style={{ width: size, height: size }}
      data-asset={variant === 'white' ? BRAND_ASSETS.logoMarkWhite : BRAND_ASSETS.logoMark}
    >
      <svg
        viewBox="0 0 24 24"
        width={size * 0.65}
        height={size * 0.65}
        fill="none"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
        className={variant === 'white' ? 'text-white' : 'text-[var(--primary-main)]'}
      >
        <path d="M12 2L3 7v10l9 5 9-5V7l-9-5z" />
        <path d="M12 22V12" />
        <path d="M12 12L3 7" />
        <path d="M12 12l9-5" />
        <circle cx="12" cy="12" r="3" fill="currentColor" fillOpacity="0.2" />
      </svg>
    </div>
  );
};
