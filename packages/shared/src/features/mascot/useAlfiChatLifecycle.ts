'use client';

import { useMemo } from 'react';
import type { AlfiLifecycleInput, AlfiState } from './types';

/**
 * useAlfiChatLifecycle maps chat lifecycle state flags (typing, request pending,
 * token stream active, tool calls, errors) to an appropriate ALFI mascot state.
 */
export function useAlfiChatLifecycle({
  isTyping = false,
  isThinking = false,
  isStreaming = false,
  isToolCalling = false,
  isError = false,
  activeTool,
  customState,
}: AlfiLifecycleInput = {}): AlfiState {
  return useMemo<AlfiState>(() => {
    if (customState) {
      return customState;
    }

    if (isError) {
      return 'chasing';
    }

    if (isStreaming) {
      return 'speaking';
    }

    if (isToolCalling) {
      const toolLower = (activeTool || '').toLowerCase();
      if (toolLower.includes('pantry') || toolLower.includes('recipe') || toolLower.includes('food') || toolLower.includes('snack')) {
        return 'eating';
      }
      if (toolLower.includes('maintenance') || toolLower.includes('device') || toolLower.includes('fix')) {
        return 'fixing';
      }
      if (toolLower.includes('chore') || toolLower.includes('clean') || toolLower.includes('cat')) {
        return 'chasing';
      }
      return 'thinking';
    }

    if (isThinking) {
      return 'thinking';
    }

    if (isTyping) {
      return 'listening';
    }

    return 'idle';
  }, [isTyping, isThinking, isStreaming, isToolCalling, isError, activeTool, customState]);
}
