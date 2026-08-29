'use client';

import React from 'react';
import { useTranslation } from '../../i18n/utils/useTranslation';
import { useHouseholdSwitcher } from '../hooks/useHouseholdSwitcher';

export function HouseholdSwitcher({ className = '' }: { className?: string }) {
  const { t } = useTranslation();
  const {
    households,
    activeId,
    selectedHousehold,
    isOpen,
    setIsOpen,
    dropdownRef,
    handleSelect,
  } = useHouseholdSwitcher();

  if (households.length === 0) return null;

  return (
    <div className={`relative inline-block ${className}`} ref={dropdownRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[var(--surface-canvas)] border border-[var(--border-subtle)] hover:border-[var(--primary-main)]/50 text-xs font-mono text-[var(--text-main)] transition-all duration-200 cursor-pointer"
        aria-label={t('household.select_household') || 'Select Household'}
      >
        <span className="material-symbols-outlined text-sm text-[var(--primary-main)]">home</span>
        <span className="font-semibold">{selectedHousehold?.name || t('household.title')}</span>
        <span className="material-symbols-outlined text-xs text-[var(--text-muted)] transition-transform duration-200">
          {isOpen ? 'expand_less' : 'expand_more'}
        </span>
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-1.5 w-48 bg-[var(--surface-card)] border border-[var(--border-subtle)] rounded-xl shadow-2xl p-1 z-50 animate-in fade-in slide-in-from-top-2 duration-150">
          {households.map((hh) => (
            <button
              key={hh.id}
              type="button"
              onClick={() => handleSelect(hh.id)}
              className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-semibold text-left transition-all duration-150 cursor-pointer ${
                activeId === hh.id
                  ? 'bg-[var(--primary-main)]/10 text-[var(--primary-main)]'
                  : 'text-[var(--text-muted)] hover:bg-[var(--surface-elevated)] hover:text-[var(--text-main)]'
              }`}
            >
              <span className="truncate">{hh.name}</span>
              {activeId === hh.id && (
                <span className="material-symbols-outlined text-xs text-[var(--primary-main)]">check</span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
