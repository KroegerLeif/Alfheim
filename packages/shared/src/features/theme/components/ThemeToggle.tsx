'use client';

import React from 'react';
import { Moon, Sun } from 'lucide-react';
import { useTranslation } from '../../i18n/utils/useTranslation';
import { useTheme } from '../hooks';
import { ThemeMode } from '../types';

export interface ThemeToggleProps {
  className?: string;
  showVariantToggle?: boolean;
}

export function ThemeToggle({ className = '', showVariantToggle = true }: ThemeToggleProps) {
  const { resolvedMode, setMode } = useTheme();
  const { t } = useTranslation();
  const label = resolvedMode === 'dark' ? t('common.switch_to_light_mode') : t('common.switch_to_dark_mode');
  const Icon = resolvedMode === 'dark' ? Sun : Moon;

  const handleToggle = () => {
    const nextMode: ThemeMode = resolvedMode === 'dark' ? 'light' : 'dark';
    setMode(nextMode);
  };

  return (
    <button
      type="button"
      onClick={handleToggle}
      className={`p-2 rounded-lg bg-[var(--surface-canvas)] border border-[var(--border-subtle)] hover:border-[var(--primary-main)]/50 text-[var(--text-main)] transition-all duration-200 cursor-pointer flex items-center justify-center group ${className}`}
      title={label}
      aria-label={label}
    >
      <Icon
        aria-hidden="true"
        className="h-4 w-4 text-[var(--primary-main)] group-hover:scale-110 transition-transform duration-200"
      />
    </button>
  );
}
