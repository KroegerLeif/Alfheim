'use client';

import React from 'react';
import { getAlfiAssetPath } from '../../assets';
import type { AlfiMascotProps, AlfiState } from './types';

const sizeMap: Record<'xs' | 'sm' | 'md' | 'lg' | 'xl', { className: string; px: number }> = {
  xs: { className: 'w-6 h-6', px: 24 },
  sm: { className: 'w-8 h-8', px: 32 },
  md: { className: 'w-12 h-12', px: 48 },
  lg: { className: 'w-24 h-24', px: 96 },
  xl: { className: 'w-48 h-48', px: 192 },
};

const haloColorMap: Record<string, string> = {
  idle: 'bg-[var(--primary-main,#3EB1FF)]/30',
  thinking: 'bg-amber-400/40',
  speaking: 'bg-emerald-400/40',
  listening: 'bg-sky-400/40',
  eating: 'bg-orange-400/40',
  fixing: 'bg-indigo-400/40',
  chasing: 'bg-rose-400/40',
  sleeping: 'bg-slate-400/20',
};

/**
 * AlfiMascot renders the full vector mascot illustration corresponding to ALFI's
 * current state with smooth transitions, responsive sizing, and optional ambient halo.
 */
export function AlfiMascot({
  state = 'idle',
  size = 'xl',
  className = '',
  onClick,
  animated = true,
  showHalo = true,
  alt,
}: AlfiMascotProps) {
  const assetPath = getAlfiAssetPath(state);
  const normalizedState = (state in haloColorMap ? state : 'idle') as string;
  const haloColor = haloColorMap[normalizedState] || haloColorMap.idle;

  // Resolve dimensions
  let dimensionClass = '';
  let style: React.CSSProperties | undefined;

  if (typeof size === 'number') {
    style = { width: size, height: size };
  } else if (size in sizeMap) {
    dimensionClass = sizeMap[size].className;
  } else {
    dimensionClass = sizeMap.xl.className;
  }

  const isInteractive = Boolean(onClick);

  return (
    <div
      data-testid="alfi-mascot"
      data-state={state}
      data-asset={assetPath}
      onClick={onClick}
      style={style}
      className={`relative inline-flex items-center justify-center shrink-0 select-none transition-transform duration-300 ${
        isInteractive ? 'cursor-pointer hover:scale-105 active:scale-95' : ''
      } ${dimensionClass} ${className}`}
    >
      {/* Ambient Glow Aura Halo */}
      {showHalo && (
        <span
          data-testid="alfi-mascot-halo"
          className={`absolute -inset-1.5 rounded-full opacity-60 blur-md pointer-events-none transition-colors duration-500 ${haloColor} ${
            animated && (state === 'thinking' || state === 'speaking' || state === 'listening')
              ? 'animate-pulse'
              : ''
          }`}
        />
      )}

      {/* SVG Asset Image with layout-shift prevention */}
      <img
        src={`/assets/${assetPath}`}
        alt={alt || `ALFI (${state})`}
        loading="eager"
        className="w-full h-full object-contain relative z-10 transition-opacity duration-300 drop-shadow-[0_0_20px_rgba(62,177,255,0.2)]"
        onError={(e) => {
          // Fallback safely to idle asset if direct asset path fails to load
          const target = e.currentTarget;
          const fallbackPath = `/assets/${getAlfiAssetPath('idle')}`;
          if (target.src !== fallbackPath) {
            target.src = fallbackPath;
          }
        }}
      />
    </div>
  );
}
