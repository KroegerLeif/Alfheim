import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ThemeProvider } from '../hooks/ThemeContext';
import { ThemeToggle } from '../components/ThemeToggle';
import { applyThemeToDOM } from '../utils/themeDomUtils';
import type { CustomColorsConfig, ResolvedMode } from '../types';

describe('theme edge cases', () => {
  const root = document.documentElement;

  beforeEach(() => {
    localStorage.clear();
    root.className = '';
    root.removeAttribute('data-mode');
    root.style.cssText = '';
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('does nothing without a document', () => {
    vi.stubGlobal('document', undefined);
    expect(() => applyThemeToDOM('nordic', 'dark')).not.toThrow();
    vi.unstubAllGlobals();
    expect(root.getAttribute('data-mode')).toBeNull();
  });

  it('falls back to the dark tokens for an unknown resolved mode', () => {
    applyThemeToDOM('nordic', 'dim' as ResolvedMode);
    expect(root.getAttribute('data-mode')).toBe('dim');
    expect(root.style.getPropertyValue('--primary-main')).not.toBe('');
  });

  it('keeps the variant tokens when custom colors lack the resolved mode', () => {
    const partial = { dark: { primary: '#123456' } } as unknown as CustomColorsConfig;
    applyThemeToDOM('custom', 'light', partial);
    expect(root.classList.contains('light')).toBe(true);
    expect(root.style.getPropertyValue('--primary-main')).not.toBe('#123456');
  });

  it('switches from light to dark mode with the toggle', () => {
    render(
      <ThemeProvider defaultMode="light">
        <ThemeToggle />
      </ThemeProvider>,
    );
    fireEvent.click(screen.getByRole('button'));
    expect(root.getAttribute('data-mode')).toBe('dark');
  });
});
