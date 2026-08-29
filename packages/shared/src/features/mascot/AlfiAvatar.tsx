'use client';

import React from 'react';
import type { AlfiAvatarProps, AlfiState } from './types';

const sizeClasses = {
  xs: 'w-5 h-5',
  sm: 'w-6 h-6',
  md: 'w-8 h-8',
  lg: 'w-12 h-12',
  xl: 'w-16 h-16',
};

/**
 * AlfiAvatar renders the compact vector avatar with dynamic glow and status indicators.
 * Suitable for chat headers, message turns, household lists, and widget headers.
 */
export function AlfiAvatar({
  status = 'idle',
  size = 'md',
  className = '',
  showStatusDot = true,
}: AlfiAvatarProps) {
  const isThinking = status === 'thinking';
  const isStreaming = status === 'streaming' || status === 'speaking';
  const isToolCalling = status === 'tool_calling' || status === 'fixing';
  const isListening = status === 'listening';
  const isEating = status === 'eating';
  const isChasing = status === 'chasing';
  const isSleeping = status === 'sleeping';

  // Resolve glow halo color class
  let haloClass = '';
  if (isThinking) {
    haloClass = 'bg-amber-400/40 animate-pulse';
  } else if (isToolCalling || isEating) {
    haloClass = 'bg-purple-400/40 animate-ping';
  } else if (isStreaming || isListening) {
    haloClass = 'bg-[var(--primary-main,#3EB1FF)]/50 animate-pulse';
  } else if (isChasing) {
    haloClass = 'bg-rose-400/40 animate-pulse';
  }

  // Resolve status dot color
  let dotColorClass = 'bg-emerald-500';
  if (isThinking) {
    dotColorClass = 'bg-amber-400 animate-pulse';
  } else if (isToolCalling) {
    dotColorClass = 'bg-purple-500';
  } else if (isStreaming) {
    dotColorClass = 'bg-emerald-400 animate-pulse';
  } else if (isListening) {
    dotColorClass = 'bg-sky-400 animate-pulse';
  } else if (isSleeping) {
    dotColorClass = 'bg-slate-400';
  } else if (isChasing) {
    dotColorClass = 'bg-rose-500';
  }

  return (
    <div
      role="img"
      aria-label={`ALFI Mascot (${status})`}
      data-status={status}
      className={`relative inline-flex items-center justify-center rounded-xl bg-gradient-to-br from-[var(--surface-canvas)] to-[var(--surface-card)] border border-[var(--border-subtle)] shadow-xs shrink-0 select-none ${
        sizeClasses[size] || sizeClasses.md
      } ${className}`}
    >
      {/* Animated Glow Halo */}
      {haloClass && (
        <span
          data-testid="alfi-avatar-halo"
          className={`absolute -inset-0.5 rounded-xl opacity-75 blur-xs ${haloClass}`}
        />
      )}

      {/* Mascot SVG Vector */}
      <svg
        viewBox="0 0 36 36"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="w-4/5 h-4/5 relative z-10 transition-transform duration-300"
      >
        {/* Antenna / Sensor */}
        <path
          d="M18 4V8"
          stroke="var(--primary-main, #3EB1FF)"
          strokeWidth="2"
          strokeLinecap="round"
        />
        <circle
          cx="18"
          cy="4"
          r="2"
          fill={
            isThinking
              ? '#F59E0B'
              : isToolCalling
              ? '#A855F7'
              : isChasing
              ? '#F43F5E'
              : 'var(--primary-main, #3EB1FF)'
          }
          className={isThinking || isStreaming ? 'animate-bounce' : ''}
        />

        {/* Outer Head Frame */}
        <rect
          x="6"
          y="8"
          width="24"
          height="20"
          rx="6"
          fill="var(--surface-card, #1E293B)"
          stroke="var(--primary-main, #3EB1FF)"
          strokeWidth="2"
        />

        {/* Visor Display */}
        <rect
          x="10"
          y="13"
          width="16"
          height="9"
          rx="3"
          fill="#0F172A"
        />

        {/* Visor Eyes / Core Display */}
        {isThinking ? (
          // Thinking animation: three small pulsing dots
          <g fill="#F59E0B">
            <circle cx="14" cy="17.5" r="1.5" className="animate-pulse" />
            <circle cx="18" cy="17.5" r="1.5" className="animate-pulse" style={{ animationDelay: '150ms' }} />
            <circle cx="22" cy="17.5" r="1.5" className="animate-pulse" style={{ animationDelay: '300ms' }} />
          </g>
        ) : isToolCalling ? (
          // Tool calling: diamond / gear core
          <g fill="#A855F7">
            <rect x="16" y="15.5" width="4" height="4" rx="1" transform="rotate(45 18 17.5)" className="animate-spin origin-center" />
          </g>
        ) : isStreaming ? (
          // Streaming animation: glowing visor line
          <g fill="var(--primary-main, #3EB1FF)">
            <rect x="13" y="16" width="3" height="3" rx="1.5" className="animate-pulse" />
            <rect x="20" y="16" width="3" height="3" rx="1.5" className="animate-pulse" />
            <line x1="14" y1="20" x2="22" y2="20" stroke="var(--primary-main, #3EB1FF)" strokeWidth="1" strokeLinecap="round" />
          </g>
        ) : isSleeping ? (
          // Sleeping state: closed visor eyes
          <g stroke="var(--text-muted, #94A3B8)" strokeWidth="1.5" strokeLinecap="round">
            <line x1="13" y1="18" x2="16" y2="18" />
            <line x1="20" y1="18" x2="23" y2="18" />
          </g>
        ) : (
          // Idle / Friendly open eyes
          <g fill="var(--primary-main, #3EB1FF)">
            <circle cx="14.5" cy="17.5" r="1.8" />
            <circle cx="21.5" cy="17.5" r="1.8" />
          </g>
        )}

        {/* Chin / Mic Accent */}
        <line
          x1="15"
          y1="25"
          x2="21"
          y2="25"
          stroke="var(--border-subtle, #334155)"
          strokeWidth="1.5"
          strokeLinecap="round"
        />
      </svg>

      {/* Mini status indicator dot */}
      {showStatusDot && (
        <span
          data-testid="alfi-status-dot"
          className={`absolute bottom-0 right-0 w-2 h-2 rounded-full ring-2 ring-[var(--surface-card,#1E293B)] z-20 ${dotColorClass}`}
        />
      )}
    </div>
  );
}
