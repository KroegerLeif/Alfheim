'use client';

import React from 'react';
import { getAlfiDataUri } from '../../assets';
import type { AlfiAvatarProps, AlfiState } from './types';

const sizeClasses = {
  xs: 'w-6 h-6',
  sm: 'w-8 h-8',
  md: 'w-10 h-10',
  lg: 'w-14 h-14',
  xl: 'w-20 h-20',
};

const dotSizeClasses = {
  xs: 'w-1.5 h-1.5',
  sm: 'w-2 h-2',
  md: 'w-2.5 h-2.5',
  lg: 'w-3.5 h-3.5',
  xl: 'w-4 h-4',
};

/**
 * AlfiAvatar renders the authentic ALFI dog mascot portrait avatar with dynamic glow
 * and active status dot indicators. Powered directly by the shared asset repository.
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

  // Map state to dog image pose
  let poseState: AlfiState = 'idle';
  if (isThinking) poseState = 'thinking';
  else if (isStreaming) poseState = 'speaking';
  else if (isListening) poseState = 'listening';
  else if (isEating) poseState = 'eating';
  else if (isToolCalling) poseState = 'fixing';
  else if (isChasing) poseState = 'chasing';
  else if (isSleeping) poseState = 'sleeping';

  const dataUri = getAlfiDataUri(poseState);

  // Resolve glow halo color class
  let haloClass = '';
  if (isThinking) {
    haloClass = 'bg-amber-400/40 animate-pulse';
  } else if (isToolCalling || isEating) {
    haloClass = 'bg-purple-400/40 animate-pulse';
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

  const dimClass = sizeClasses[size] || sizeClasses.md;
  const dotDimClass = dotSizeClasses[size] || dotSizeClasses.md;

  return (
    <div
      role="img"
      aria-label={`ALFI Mascot (${status})`}
      data-testid="alfi-avatar"
      data-status={status}
      className={`relative inline-flex items-center justify-center shrink-0 select-none rounded-full ${dimClass} ${className}`}
    >
      {/* Ambient Glow Aura */}
      {haloClass && (
        <span
          data-testid="alfi-avatar-halo"
          className={`absolute -inset-1 rounded-full blur-sm pointer-events-none transition-all duration-300 ${haloClass}`}
        />
      )}

      {/* Circular Avatar Container with Dog Portrait */}
      <div className="relative z-10 w-full h-full rounded-full overflow-hidden bg-[var(--surface-card,#1E293B)] border border-[var(--border-subtle,#334155)] shadow-xs flex items-center justify-center">
        <img
          src={dataUri}
          alt="ALFI"
          className="w-full h-full object-cover object-top scale-110"
        />
      </div>

      {/* Status Dot Indicator */}
      {showStatusDot && (
        <span
          data-testid="alfi-status-dot"
          className={`absolute bottom-0 right-0 z-20 rounded-full ring-2 ring-[var(--surface-canvas,#0B0F17)] ${dotDimClass} ${dotColorClass}`}
        />
      )}
    </div>
  );
}
