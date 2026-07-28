'use client';

import React, { useState, useRef, useEffect } from 'react';
import { useTheme } from '../theme';
import { ThemeMode, ThemeVariant } from '../theme/types';

export interface ThemeToggleProps {
  className?: string;
  showVariantToggle?: boolean;
}

export function ThemeToggle({ className = '', showVariantToggle = true }: ThemeToggleProps) {
  const { mode, variant, resolvedMode, setMode, setVariant } = useTheme();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const getModeIcon = () => {
    if (mode === 'system') return 'desktop_windows';
    return resolvedMode === 'dark' ? 'dark_mode' : 'light_mode';
  };

  const themes: { id: ThemeVariant; label: string; icon: string }[] = [
    { id: 'obsidian', label: 'Obsidian', icon: 'dark_mode' },
    { id: 'kinetic', label: 'Kinetic', icon: 'bolt' },
    { id: 'slate', label: 'Slate', icon: 'palette' },
  ];

  return (
    <div className={`relative inline-block ${className}`} ref={dropdownRef}>
      <button
        type="button"
        onClick={() => {
          if (!showVariantToggle) {
            const nextMode: ThemeMode = resolvedMode === 'dark' ? 'light' : 'dark';
            setMode(nextMode);
          } else {
            setIsOpen(!isOpen);
          }
        }}
        className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[var(--surface-canvas)] border border-[var(--border-subtle)] hover:border-[var(--primary-main)]/50 text-xs font-mono text-[var(--text-main)] transition-all duration-200 cursor-pointer group"
        title="Theme settings"
      >
        <span className="material-symbols-outlined text-base text-[var(--primary-main)] group-hover:rotate-180 transition-transform duration-300">
          {getModeIcon()}
        </span>
        <span className="capitalize font-semibold">{variant} ({resolvedMode})</span>
        {showVariantToggle && (
          <span className="material-symbols-outlined text-xs text-[var(--text-muted)]">
            {isOpen ? 'expand_less' : 'expand_more'}
          </span>
        )}
      </button>

      {isOpen && showVariantToggle && (
        <div className="absolute right-0 mt-1.5 w-56 bg-[var(--surface-card)] border border-[var(--border-subtle)] rounded-xl shadow-2xl p-3 z-50 animate-in fade-in slide-in-from-top-2 duration-150 space-y-3">
          {/* Mode Selector */}
          <div>
            <div className="text-[10px] font-mono uppercase text-[var(--text-muted)] mb-1.5 font-bold">
              Mode
            </div>
            <div className="grid grid-cols-3 gap-1 p-1 bg-[var(--surface-canvas)] rounded-lg border border-[var(--border-subtle)]">
              {(['dark', 'light', 'system'] as ThemeMode[]).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setMode(m)}
                  className={`py-1.5 rounded text-[11px] font-mono capitalize transition-all cursor-pointer flex items-center justify-center gap-1 ${
                    mode === m
                      ? 'bg-[var(--surface-elevated)] text-[var(--primary-main)] font-bold border border-[var(--border-accent)]'
                      : 'text-[var(--text-muted)] hover:text-[var(--text-main)]'
                  }`}
                >
                  <span className="material-symbols-outlined text-xs">
                    {m === 'dark' ? 'dark_mode' : m === 'light' ? 'light_mode' : 'desktop_windows'}
                  </span>
                  <span>{m}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Theme Selector */}
          <div>
            <div className="text-[10px] font-mono uppercase text-[var(--text-muted)] mb-1.5 font-bold">
              Theme Palette
            </div>
            <div className="grid grid-cols-3 gap-1 p-1 bg-[var(--surface-canvas)] rounded-lg border border-[var(--border-subtle)]">
              {themes.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setVariant(t.id)}
                  className={`py-1.5 px-1 rounded text-[11px] font-mono capitalize transition-all cursor-pointer flex flex-col items-center justify-center gap-1 ${
                    variant === t.id
                      ? 'bg-[var(--surface-elevated)] text-[var(--primary-main)] font-bold border border-[var(--border-accent)]'
                      : 'text-[var(--text-muted)] hover:text-[var(--text-main)]'
                  }`}
                >
                  <span className="material-symbols-outlined text-xs">
                    {t.icon}
                  </span>
                  <span className="text-[10px]">{t.label}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
