'use client';

import React, { useState, useRef, useEffect } from 'react';
import { useTranslation, Language } from '../utils';

export interface LanguageOption {
  code: Language;
  label: string;
  flag: string;
}

const LANGUAGES: LanguageOption[] = [
  { code: 'de', label: 'Deutsch', flag: '🇩🇪' },
  { code: 'en', label: 'English', flag: '🇬🇧' },
  { code: 'pl', label: 'Polski', flag: '🇵🇱' },
];

export interface LanguageSwitcherProps {
  className?: string;
  variant?: 'dropdown' | 'buttons';
}

export function LanguageSwitcher({ className = '', variant = 'dropdown' }: LanguageSwitcherProps) {
  const { language, setLanguage } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const currentLangOption = LANGUAGES.find((l) => l.code === language) || LANGUAGES[0];

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  if (variant === 'buttons') {
    return (
      <div className={`inline-flex items-center p-1 rounded-lg bg-[var(--surface-canvas)] border border-[var(--border-subtle)] gap-1 ${className}`}>
        {LANGUAGES.map((lang) => (
          <button
            key={lang.code}
            type="button"
            onClick={() => setLanguage(lang.code)}
            className={`px-2 py-1 rounded text-xs font-mono font-medium transition-all duration-150 cursor-pointer flex items-center gap-1.5 ${
              language === lang.code
                ? 'bg-[var(--surface-elevated)] text-[var(--primary-main)] border border-[var(--border-accent)]'
                : 'text-[var(--text-muted)] hover:text-[var(--text-main)]'
            }`}
          >
            <span>{lang.flag}</span>
            <span className="uppercase">{lang.code}</span>
          </button>
        ))}
      </div>
    );
  }

  return (
    <div className={`relative inline-block ${className}`} ref={dropdownRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[var(--surface-canvas)] border border-[var(--border-subtle)] hover:border-[var(--primary-main)]/50 text-xs font-mono text-[var(--text-main)] transition-all duration-200 cursor-pointer"
        aria-label="Select Language"
      >
        <span className="text-sm">{currentLangOption.flag}</span>
        <span className="uppercase font-semibold">{currentLangOption.code}</span>
        <span className="material-symbols-outlined text-xs text-[var(--text-muted)] transition-transform duration-200">
          {isOpen ? 'expand_less' : 'expand_more'}
        </span>
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-1.5 w-36 bg-[var(--surface-card)] border border-[var(--border-subtle)] rounded-xl shadow-2xl p-1 z-50 animate-in fade-in slide-in-from-top-2 duration-150">
          {LANGUAGES.map((lang) => (
            <button
              key={lang.code}
              type="button"
              onClick={() => {
                setLanguage(lang.code);
                setIsOpen(false);
              }}
              className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-mono transition-colors cursor-pointer ${
                language === lang.code
                  ? 'bg-[var(--surface-elevated)] text-[var(--primary-main)] font-bold'
                  : 'text-[var(--text-muted)] hover:text-[var(--text-main)] hover:bg-[var(--surface-elevated)]/50'
              }`}
            >
              <div className="flex items-center gap-2">
                <span>{lang.flag}</span>
                <span>{lang.label}</span>
              </div>
              {language === lang.code && (
                <span className="material-symbols-outlined text-xs text-[var(--primary-main)]">
                  check
                </span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
