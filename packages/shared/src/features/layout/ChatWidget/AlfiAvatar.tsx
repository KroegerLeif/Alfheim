'use client';

import React from 'react';
import { AlfiStatus } from './types';

export interface AlfiAvatarProps {
  status?: AlfiStatus;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const sizeClasses = {
  sm: 'w-6 h-6',
  md: 'w-8 h-8',
  lg: 'w-12 h-12',
};

export function AlfiAvatar({
  status = 'idle',
  size = 'md',
  className = '',
}: AlfiAvatarProps) {
  const isThinking = status === 'thinking';
  const isStreaming = status === 'streaming';
  const isToolCalling = status === 'tool_calling';

  return (
    <div
      role="img"
      aria-label={`ALFI Mascot (${status})`}
      className={`relative inline-flex items-center justify-center rounded-xl bg-gradient-to-br from-[var(--surface-canvas)] to-[var(--surface-card)] border border-[var(--border-subtle)] shadow-sm shrink-0 select-none ${sizeClasses[size]} ${className}`}
    >
      {/* Animated Glow Halo */}
      {(isThinking || isStreaming || isToolCalling) && (
        <span
          className={`absolute -inset-0.5 rounded-xl opacity-75 blur-xs ${
            isThinking
              ? 'bg-amber-400/40 animate-pulse'
              : isToolCalling
              ? 'bg-purple-400/40 animate-ping'
              : 'bg-[var(--primary-main)]/50 animate-pulse'
          }`}
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
          stroke="var(--primary-main)"
          strokeWidth="2"
          strokeLinecap="round"
        />
        <circle
          cx="18"
          cy="4"
          r="2"
          fill={isThinking ? '#F59E0B' : isToolCalling ? '#A855F7' : 'var(--primary-main)'}
          className={isThinking || isStreaming ? 'animate-bounce' : ''}
        />

        {/* Outer Head Frame */}
        <rect
          x="6"
          y="8"
          width="24"
          height="20"
          rx="6"
          fill="var(--surface-card)"
          stroke="var(--primary-main)"
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
          <g fill="var(--primary-main)">
            <rect x="13" y="16" width="3" height="3" rx="1.5" className="animate-pulse" />
            <rect x="20" y="16" width="3" height="3" rx="1.5" className="animate-pulse" />
            <line x1="14" y1="20" x2="22" y2="20" stroke="var(--primary-main)" strokeWidth="1" strokeLinecap="round" />
          </g>
        ) : (
          // Idle state: bright friendly eyes
          <g fill="var(--primary-main)">
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
          stroke="var(--border-subtle)"
          strokeWidth="1.5"
          strokeLinecap="round"
        />
      </svg>

      {/* Mini status indicator dot */}
      <span
        data-testid="alfi-status-dot"
        className={`absolute bottom-0 right-0 w-2 h-2 rounded-full ring-2 ring-[var(--surface-card)] z-20 ${
          isThinking
            ? 'bg-amber-400 animate-pulse'
            : isToolCalling
            ? 'bg-purple-500'
            : isStreaming
            ? 'bg-emerald-400 animate-pulse'
            : 'bg-emerald-500'
        }`}
      />
    </div>
  );
}
