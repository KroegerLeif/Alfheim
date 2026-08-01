'use client';

import React from 'react';
import { useTranslation } from '../../i18n/utils/useTranslation';

export type StatusBadgeVariant = 'active' | 'in_progress' | 'maintenance' | string;

export interface StatusBadgeProps {
  status?: StatusBadgeVariant;
  className?: string;
}

export function StatusBadge({ status = 'active', className = '' }: StatusBadgeProps) {
  const { t } = useTranslation();

  switch (status) {
    case 'in_progress':
      return (
        <span
          className={`px-2 py-0.5 text-[10px] font-mono uppercase rounded bg-amber-950/60 text-amber-400 border border-amber-800/40 font-bold inline-block ${className}`}
        >
          {t('common.in_progress')}
        </span>
      );
    case 'maintenance':
      return (
        <span
          className={`px-2 py-0.5 text-[10px] font-mono uppercase rounded bg-red-950/60 text-red-400 border border-red-800/40 font-bold inline-block ${className}`}
        >
          {t('common.maintenance')}
        </span>
      );
    default:
      return (
        <span
          className={`px-2 py-0.5 text-[10px] font-mono uppercase rounded bg-emerald-950/60 text-emerald-400 border border-emerald-800/40 font-bold inline-block ${className}`}
        >
          {t('common.active')}
        </span>
      );
  }
}
