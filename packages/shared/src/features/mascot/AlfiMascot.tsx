'use client';

import React from 'react';
import { getAlfiAssetPath } from '../../assets';
import type { AlfiMascotProps, AlfiState } from './types';

const sizeMap: Record<'xs' | 'sm' | 'md' | 'lg' | 'xl', { className: string; px: number }> = {
  xs: { className: 'w-8 h-8', px: 32 },
  sm: { className: 'w-12 h-12', px: 48 },
  md: { className: 'w-20 h-20', px: 80 },
  lg: { className: 'w-32 h-32', px: 128 },
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
 * AlfiMascot renders the rich vector mascot illustration corresponding to ALFI's
 * current state with smooth transitions, zero-dependency self-contained SVG vectors,
 * responsive sizing, and state-reactive ambient aura.
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

  const isThinking = state === 'thinking';
  const isSpeaking = state === 'speaking' || state === 'loading';
  const isListening = state === 'listening' || state === 'curious';
  const isEating = state === 'eating';
  const isFixing = state === 'fixing';
  const isChasing = state === 'chasing';
  const isSleeping = state === 'sleeping';

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
          className={`absolute -inset-2 rounded-full opacity-60 blur-lg pointer-events-none transition-colors duration-500 ${haloColor} ${
            animated && (isThinking || isSpeaking || isListening) ? 'animate-pulse' : ''
          }`}
        />
      )}

      {/* High-fidelity Scalable SVG Mascot Illustration */}
      <svg
        viewBox="0 0 120 120"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="w-full h-full relative z-10 drop-shadow-[0_0_24px_rgba(62,177,255,0.25)] transition-all duration-300"
      >
        {/* Orbital Atmosphere Ring */}
        <ellipse
          cx="60"
          cy="60"
          rx="52"
          ry="20"
          transform={isThinking ? 'rotate(-25 60 60)' : 'rotate(-12 60 60)'}
          stroke={
            isThinking
              ? '#F59E0B'
              : isSpeaking
              ? '#10B981'
              : isListening
              ? '#38BDF8'
              : isChasing
              ? '#F43F5E'
              : 'var(--primary-main, #3EB1FF)'
          }
          strokeWidth="2"
          strokeDasharray="6 4"
          strokeOpacity="0.6"
          className={animated && (isThinking || isSpeaking) ? 'animate-spin origin-center' : ''}
          style={{ animationDuration: '12s' }}
        />

        {/* Antenna Post & Top Orb */}
        <line
          x1="60"
          y1="16"
          x2="60"
          y2="28"
          stroke="var(--primary-main, #3EB1FF)"
          strokeWidth="3.5"
          strokeLinecap="round"
        />
        <circle
          cx="60"
          cy="14"
          r="6"
          fill={
            isThinking
              ? '#F59E0B'
              : isSpeaking
              ? '#10B981'
              : isListening
              ? '#38BDF8'
              : isEating
              ? '#FB923C'
              : isFixing
              ? '#818CF8'
              : isChasing
              ? '#F43F5E'
              : 'var(--primary-main, #3EB1FF)'
          }
          className={animated && (isThinking || isSpeaking) ? 'animate-bounce' : ''}
        />

        {/* Mascot Head Body Frame */}
        <rect
          x="24"
          y="28"
          width="72"
          height="64"
          rx="22"
          fill="var(--surface-card, #1E293B)"
          stroke="var(--primary-main, #3EB1FF)"
          strokeWidth="3.5"
        />

        {/* Left and Right Sensor Ears */}
        <rect x="16" y="46" width="8" height="28" rx="4" fill="var(--border-subtle, #334155)" stroke="var(--primary-main, #3EB1FF)" strokeWidth="2" />
        <rect x="96" y="46" width="8" height="28" rx="4" fill="var(--border-subtle, #334155)" stroke="var(--primary-main, #3EB1FF)" strokeWidth="2" />

        {/* Dark Visor Display Screen */}
        <rect
          x="34"
          y="42"
          width="52"
          height="34"
          rx="12"
          fill="#0F172A"
          stroke="var(--border-subtle, #334155)"
          strokeWidth="1.5"
        />

        {/* Visor State Expressions */}
        {isThinking ? (
          // Thinking: Pulsing data clusters and rotating thoughts
          <g fill="#F59E0B">
            <circle cx="48" cy="59" r="4" className="animate-pulse" />
            <circle cx="60" cy="59" r="4" className="animate-pulse" style={{ animationDelay: '150ms' }} />
            <circle cx="72" cy="59" r="4" className="animate-pulse" style={{ animationDelay: '300ms' }} />
          </g>
        ) : isSpeaking ? (
          // Speaking: Dynamic equalizer voice waveform & energetic eyes
          <g>
            <circle cx="48" cy="55" r="4" fill="#10B981" />
            <circle cx="72" cy="55" r="4" fill="#10B981" />
            <path d="M46 67 C54 73, 66 73, 74 67" stroke="#10B981" strokeWidth="3" strokeLinecap="round" />
          </g>
        ) : isListening ? (
          // Listening: Audio sensor arches and curious wide eyes
          <g>
            <circle cx="48" cy="57" r="5" fill="#38BDF8" />
            <circle cx="72" cy="57" r="5" fill="#38BDF8" />
            <path d="M54 67 Q60 69 66 67" stroke="#38BDF8" strokeWidth="2.5" strokeLinecap="round" />
          </g>
        ) : isEating ? (
          // Eating: Gourmet snack expression with chewing smile
          <g>
            <path d="M44 54 Q48 50 52 54" stroke="#FB923C" strokeWidth="3" strokeLinecap="round" />
            <path d="M68 54 Q72 50 76 54" stroke="#FB923C" strokeWidth="3" strokeLinecap="round" />
            <ellipse cx="60" cy="65" rx="6" ry="4" fill="#FB923C" />
          </g>
        ) : isFixing ? (
          // Fixing: Wrench mechanic focused eyes
          <g>
            <rect x="44" y="55" width="8" height="3" rx="1.5" fill="#818CF8" />
            <rect x="68" y="55" width="8" height="3" rx="1.5" fill="#818CF8" />
            <path d="M52 66 L68 66" stroke="#818CF8" strokeWidth="2.5" strokeLinecap="round" />
          </g>
        ) : isChasing ? (
          // Chasing: Playful cat-chasing focused streak eyes
          <g>
            <path d="M44 54 L52 58" stroke="#F43F5E" strokeWidth="3" strokeLinecap="round" />
            <path d="M76 54 L68 58" stroke="#F43F5E" strokeWidth="3" strokeLinecap="round" />
            <path d="M48 66 Q60 72 72 66" stroke="#F43F5E" strokeWidth="2.5" strokeLinecap="round" />
          </g>
        ) : isSleeping ? (
          // Sleeping: Closed gentle lines and sleep indicator
          <g stroke="var(--text-muted, #94A3B8)" strokeWidth="2.5" strokeLinecap="round">
            <line x1="44" y1="58" x2="52" y2="58" />
            <line x1="68" y1="58" x2="76" y2="58" />
            <path d="M54 67 Q60 65 66 67" strokeWidth="1.5" />
          </g>
        ) : (
          // Idle: Bright, friendly open eyes with warm smile
          <g>
            <circle cx="48" cy="58" r="4.5" fill="var(--primary-main, #3EB1FF)" />
            <circle cx="72" cy="58" r="4.5" fill="var(--primary-main, #3EB1FF)" />
            <path d="M52 67 Q60 72 68 67" stroke="var(--primary-main, #3EB1FF)" strokeWidth="2.5" strokeLinecap="round" />
          </g>
        )}

        {/* Lower Chin Mic Bar */}
        <line
          x1="48"
          y1="82"
          x2="72"
          y2="82"
          stroke="var(--border-subtle, #334155)"
          strokeWidth="2.5"
          strokeLinecap="round"
        />
      </svg>
    </div>
  );
}
