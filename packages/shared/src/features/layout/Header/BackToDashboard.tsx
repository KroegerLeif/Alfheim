'use client';

import React from 'react';
import { useTranslation } from '../../i18n/utils';

export interface BackToDashboardProps {
  href?: string;
  label?: string;
  className?: string;
}

export function BackToDashboard({
  href = '/',
  label,
  className = '',
}: BackToDashboardProps) {
  const { t } = useTranslation();
  const displayLabel = label || t('common.back_to_dashboard');

  return (
    <a
      href={href}
      className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[var(--surface-canvas)] border border-[var(--border-subtle)] hover:border-[var(--primary-main)]/50 text-xs font-mono text-[var(--text-main)] hover:text-[var(--primary-main)] transition-all duration-200 cursor-pointer shadow-sm group ${className}`}
    >
      <span className="material-symbols-outlined text-sm text-[var(--primary-main)] group-hover:-translate-x-0.5 transition-transform duration-200">
        arrow_back
      </span>
      <span>{displayLabel}</span>
    </a>
  );
}
