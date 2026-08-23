'use client';

import { useState, useEffect, useRef } from 'react';
import { useTranslation } from '@alfheim/shared';

interface ColorPickerProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  swatches: string[];
}

export function ColorPicker({ label, value, onChange, swatches }: ColorPickerProps) {
  const { t } = useTranslation();
  const [inputValue, setInputValue] = useState(value);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { setInputValue(value); }, [value]);

  const handleHexChange = (val: string) => {
    setInputValue(val);
    if (/^#[0-9A-Fa-f]{6}$/.test(val)) onChange(val);
  };

  return (
    <div className="space-y-2.5">
      <label className="block text-[11px] font-mono text-[var(--text-muted)] uppercase tracking-wider">{label}</label>
      <div className="flex flex-col gap-3">
        <div className="flex gap-2.5 items-center">
          <div
            onClick={() => inputRef.current?.click()}
            className="w-10 h-10 border border-[var(--border-subtle)] rounded-xl cursor-pointer hover:scale-105 hover:shadow-md transition-all shrink-0 relative overflow-hidden"
            style={{ backgroundColor: value }}
            title={t('common.select_icon')}
          >
            <input
              ref={inputRef}
              type="color"
              value={value}
              onChange={(e) => onChange(e.target.value)}
              className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
            />
          </div>
          <input
            type="text"
            value={inputValue}
            onChange={(e) => handleHexChange(e.target.value)}
            placeholder="#3eb1ff"
            className="flex-1 max-w-[140px] px-3.5 py-2.5 bg-[var(--surface-canvas)] border border-[var(--border-subtle)] rounded-xl text-xs font-mono text-[var(--text-main)] focus:outline-none focus:border-[var(--primary-main)] transition-colors"
          />
        </div>

        <div className="flex flex-wrap gap-1.5 pt-1">
          {swatches.map((swatch) => (
            <button
              key={swatch}
              onClick={() => { onChange(swatch); setInputValue(swatch); }}
              className={`w-6 h-6 rounded-lg border transition-all hover:scale-110 cursor-pointer ${
                value.toLowerCase() === swatch.toLowerCase()
                  ? 'border-[var(--primary-main)] scale-105 shadow-[0_0_8px_var(--accent-glow)]'
                  : 'border-[var(--border-subtle)] hover:border-[var(--text-muted)]'
              }`}
              style={{ backgroundColor: swatch }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
