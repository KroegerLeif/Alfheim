'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useTranslation } from '../../i18n/utils/useTranslation';

const STORAGE_KEY = 'alfheim_active_household_id';
const CACHE_KEY = 'alfheim_cached_households';

interface Household {
  id: string;
  name: string;
  slug: string;
  is_default?: boolean;
}

export function HouseholdSwitcher({ className = '' }: { className?: string }) {
  const { t } = useTranslation();
  const [households, setHouseholds] = useState<Household[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Load cached households for instant render (stale-while-revalidate)
    try {
      const cachedHouseholds = localStorage.getItem(CACHE_KEY);
      if (cachedHouseholds) {
        const parsed = JSON.parse(cachedHouseholds);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setHouseholds(parsed);
        }
      }
    } catch {
      // Ignore malformed cache
    }

    // Load active ID from localStorage
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      setActiveId(saved);
    }

    // Fetch households from central dashboard backend using active frontend auth tokens
    const token = sessionStorage.getItem('token_chores-frontend') ||
                  sessionStorage.getItem('token_maintenance-frontend') ||
                  sessionStorage.getItem('token_pantry-frontend') ||
                  sessionStorage.getItem('token_shopping-frontend');

    if (token) {
      const fetchHouseholds = async (url: string): Promise<boolean> => {
        try {
          const res = await fetch(url, {
            headers: {
              'Authorization': `Bearer ${token}`
            }
          });
          if (!res.ok) throw new Error(`Status ${res.status}`);
          const data = await res.json();
          if (Array.isArray(data)) {
            setHouseholds(data);
            // Cache households for instant render on next mount
            try {
              localStorage.setItem(CACHE_KEY, JSON.stringify(data));
            } catch {
              // Ignore storage quota errors
            }
            const activeSaved = localStorage.getItem(STORAGE_KEY);
            const exists = data.some(h => h.id === activeSaved);
            if ((!activeSaved || !exists) && data.length > 0) {
              const defaultHh = data.find(h => h.is_default) || data[0];
              localStorage.setItem(STORAGE_KEY, defaultHh.id);
              setActiveId(defaultHh.id);
              window.dispatchEvent(new Event('storage-household-changed'));
            }
            return true;
          }
        } catch (err) {
          console.warn(`Failed to fetch households from ${url}:`, err);
        }
        return false;
      };

      const runFetch = async () => {
        const success = await fetchHouseholds('/api/v1/households/me');
        if (!success) {
          await fetchHouseholds('http://alfheim/api/v1/households/me');
        }
      };

      runFetch();
    }

    // Sync storage events
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY) {
        setActiveId(e.newValue);
      }
    };

    const handleLocalChange = () => {
      setActiveId(localStorage.getItem(STORAGE_KEY));
    };

    window.addEventListener('storage', handleStorageChange);
    window.addEventListener('storage-household-changed', handleLocalChange);

    // Click outside listener
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);

    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('storage-household-changed', handleLocalChange);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const handleSelect = (id: string) => {
    localStorage.setItem(STORAGE_KEY, id);
    setActiveId(id);
    setIsOpen(false);
    window.dispatchEvent(new Event('storage-household-changed'));
  };

  const selectedHousehold = households.find(h => h.id === activeId) || households[0];

  if (households.length === 0) return null;

  return (
    <div className={`relative inline-block ${className}`} ref={dropdownRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[var(--surface-canvas)] border border-[var(--border-subtle)] hover:border-[var(--primary-main)]/50 text-xs font-mono text-[var(--text-main)] transition-all duration-200 cursor-pointer"
        aria-label="Select Household"
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
