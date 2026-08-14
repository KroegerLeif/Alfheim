'use client';

import React, { useState, useRef, useEffect } from 'react';
import {
  Apple, Banana, Milk, Carrot, Coffee, Egg, Beef, Cookie, Pizza, Wine,
  Sparkles, ShoppingBag, Package, Box, Tag, Utensils, CupSoda, Flame,
  Heart, Star, Smile,
} from 'lucide-react';
import { useTranslation } from '../../i18n/utils/useTranslation';

export interface IconOption {
  id: string;
  name: string;
  component: React.ComponentType<{ className?: string }>;
}

export const AVAILABLE_ICONS: IconOption[] = [
  { id: 'apple', name: 'Apple', component: Apple },
  { id: 'banana', name: 'Banana', component: Banana },
  { id: 'milk', name: 'Milk', component: Milk },
  { id: 'carrot', name: 'Carrot', component: Carrot },
  { id: 'coffee', name: 'Coffee', component: Coffee },
  { id: 'egg', name: 'Egg', component: Egg },
  { id: 'beef', name: 'Beef', component: Beef },
  { id: 'cookie', name: 'Cookie', component: Cookie },
  { id: 'pizza', name: 'Pizza', component: Pizza },
  { id: 'wine', name: 'Wine', component: Wine },
  { id: 'sparkles', name: 'Sparkles', component: Sparkles },
  { id: 'bag', name: 'Shopping Bag', component: ShoppingBag },
  { id: 'package', name: 'Package', component: Package },
  { id: 'box', name: 'Box', component: Box },
  { id: 'tag', name: 'Tag', component: Tag },
  { id: 'utensils', name: 'Utensils', component: Utensils },
  { id: 'soda', name: 'Soda', component: CupSoda },
  { id: 'flame', name: 'Flame', component: Flame },
  { id: 'heart', name: 'Heart', component: Heart },
  { id: 'star', name: 'Star', component: Star },
  { id: 'smile', name: 'Smile', component: Smile },
];

interface IconPickerProps {
  selectedIconId: string | null;
  onSelectIcon: (iconId: string) => void;
  className?: string;
}

export function IconPicker({ selectedIconId, onSelectIcon, className = '' }: IconPickerProps) {
  const { t } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const dropdownRef = useRef<HTMLDivElement>(null);

  const currentIconObj = AVAILABLE_ICONS.find((i) => i.id === selectedIconId) || AVAILABLE_ICONS[0];
  const CurrentIcon = currentIconObj.component;

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const filteredIcons = AVAILABLE_ICONS.filter((icon) =>
    icon.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className={`relative inline-block ${className}`} ref={dropdownRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="h-10 w-10 rounded-xl bg-[var(--surface-canvas)] hover:bg-[var(--surface-elevated)] border border-[var(--border-subtle)] flex items-center justify-center text-[var(--primary-main)] cursor-pointer transition-all duration-200"
        title={t('common.select_icon')}
        aria-label={t('common.select_icon')}
      >
        <CurrentIcon className="h-5 w-5" />
      </button>

      {isOpen && (
        <div className="absolute right-0 top-full mt-2 w-72 sm:w-80 bg-[var(--surface-card)] border border-[var(--border-subtle)] rounded-xl shadow-2xl p-3 z-[9999] animate-in fade-in slide-in-from-top-2 duration-150">
          <div className="text-[10px] font-mono font-bold uppercase tracking-widest text-[var(--text-muted)] mb-2">
            {t('common.select_icon')}
          </div>

          <div className="mb-2">
            <input
              type="text"
              placeholder={t('common.search_placeholder') || 'Search icon...'}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full h-8 px-2.5 rounded-lg bg-[var(--surface-canvas)] border border-[var(--border-subtle)] text-xs text-[var(--text-main)] placeholder-[var(--text-muted)] outline-none focus:border-[var(--primary-main)]"
            />
          </div>

          <div className="grid grid-cols-5 gap-2 max-h-56 overflow-y-auto p-1 bg-[var(--surface-canvas)] rounded-xl border border-[var(--border-subtle)]">
            {filteredIcons.map((iconItem) => {
              const IconComp = iconItem.component;
              const isSelected = selectedIconId === iconItem.id;

              return (
                <button
                  key={iconItem.id}
                  type="button"
                  onClick={() => {
                    onSelectIcon(iconItem.id);
                    setIsOpen(false);
                  }}
                  className={`h-9 w-9 rounded-lg flex items-center justify-center transition-all cursor-pointer ${
                    isSelected
                      ? 'bg-[var(--primary-main)]/20 border border-[var(--primary-main)] text-[var(--primary-main)] scale-105 shadow-md'
                      : 'text-[var(--text-muted)] hover:text-[var(--text-main)] hover:bg-[var(--surface-elevated)]'
                  }`}
                  title={iconItem.name}
                >
                  <IconComp className="h-4 w-4" />
                </button>
              );
            })}

            {filteredIcons.length === 0 && (
              <div className="col-span-5 text-center py-4 text-xs text-[var(--text-muted)] italic">
                {t('common.no_results') || 'No icons found'}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
