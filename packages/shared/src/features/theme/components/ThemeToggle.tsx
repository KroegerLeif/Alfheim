'use client';

import React from 'react';
import { useTheme } from '../hooks';
import { ThemeMode } from '../types';

export interface ThemeToggleProps {
  className?: string;
  showVariantToggle?: boolean;
}

export function ThemeToggle({ className = '', showVariantToggle = true }: ThemeToggleProps) {
  const { resolvedMode, setMode } = useTheme();

  const handleToggle = () => {
    const nextMode: ThemeMode = resolvedMode === 'dark' ? 'light' : 'dark';
    setMode(nextMode);
  };

  return (
    <button
      type="button"
      onClick={handleToggle}
      className={`p-2 rounded-lg bg-[var(--surface-canvas)] border border-[var(--border-subtle)] hover:border-[var(--primary-main)]/50 text-[var(--text-main)] transition-all duration-200 cursor-pointer flex items-center justify-center group ${className}`}
      title={resolvedMode === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
    >
      <span className="material-symbols-outlined text-base text-[var(--primary-main)] group-hover:scale-110 transition-transform duration-200">
        {resolvedMode === 'dark' ? 'light_mode' : 'dark_mode'}
      </span>
    </button>
  );
}
