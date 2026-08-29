'use client';

import React from 'react';
import { getAlfiAssetPath, getAlfiDataUri } from '../../assets';
import type { AlfiMascotProps } from './types';

const sizeMap: Record<'xs' | 'sm' | 'md' | 'lg' | 'xl', { className: string; px: number }> = {
  xs: { className: 'w-8 h-8', px: 32 },
  sm: { className: 'w-12 h-12', px: 48 },
  md: { className: 'w-20 h-20', px: 80 },
  lg: { className: 'w-36 h-36', px: 144 },
  xl: { className: 'w-56 h-56', px: 224 },
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
 * AlfiMascot renders the authentic ALFI dog mascot illustration corresponding to ALFI's
 * current state with smooth transitions, responsive sizing, and state-reactive ambient aura.
 * Powered directly by the shared asset data repository.
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
  const dataUri = getAlfiDataUri(state);
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
  const isPulsing = state === 'thinking' || state === 'speaking' || state === 'listening' || state === 'loading';

  return (
    <div
      data-testid="alfi-mascot"
      data-state={state}
      data-asset={assetPath}
      onClick={onClick}
      style={style}
      aria-label={alt || `ALFI (${state})`}
      className={`relative inline-flex items-center justify-center shrink-0 select-none transition-transform duration-300 ${
        isInteractive ? 'cursor-pointer hover:scale-105 active:scale-95' : ''
      } ${dimensionClass} ${className}`}
    >
      {/* Ambient Glow Aura Halo */}
      {showHalo && (
        <span
          data-testid="alfi-mascot-halo"
          className={`absolute -inset-3 rounded-full opacity-60 blur-xl pointer-events-none transition-colors duration-500 ${haloColor} ${
            animated && isPulsing ? 'animate-pulse' : ''
          }`}
        />
      )}

      {/* Authentic High-Resolution Dog Mascot Artwork */}
      <img
        src={dataUri}
        alt={alt || `ALFI (${state})`}
        loading="eager"
        className={`w-full h-full object-contain relative z-10 drop-shadow-[0_4px_24px_rgba(0,0,0,0.25)] transition-all duration-300 ${
          animated && isPulsing ? 'scale-[1.02]' : ''
        }`}
        onError={(e) => {
          const target = e.currentTarget;
          const fallbackUri = getAlfiDataUri('idle');
          if (target.src !== fallbackUri) {
            target.src = fallbackUri;
          }
        }}
      />
    </div>
  );
}
