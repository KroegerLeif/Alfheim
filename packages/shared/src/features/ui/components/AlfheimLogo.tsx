'use client';

import React from 'react';
import { BRAND_ASSETS } from '../../../assets';
import { AlfheimMark } from '../../../assets/brand/AlfheimMark';

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
          <AlfheimMark size={size * 0.65} className="text-[var(--primary-main)]" />
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
      <AlfheimMark
        size={size * 0.65}
        className={variant === 'white' ? 'text-white' : 'text-[var(--primary-main)]'}
      />
    </div>
  );
};
