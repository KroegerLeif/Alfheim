import { renderToString } from 'react-dom/server';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ThemeProvider } from '../hooks/ThemeContext';
import { useTheme } from '../hooks/useTheme';
import { DEFAULT_CUSTOM_COLORS } from '../utils/customColors';

/**
 * Server render: no window and no localStorage, so every stored preference is
 * skipped and the provider renders from its props and defaults. The shared test
 * setup needs jsdom, so `window` is stubbed away per test.
 */
function ThemeProbe({ writeColors = false }: { writeColors?: boolean }) {
  const theme = useTheme();
  if (writeColors) {
    // A setter called during a server render must not touch localStorage.
    theme.setCustomColors(DEFAULT_CUSTOM_COLORS);
  }
  return <span data-mode={theme.mode} data-variant={theme.variant} data-dark={String(theme.isDark)} />;
}

describe('ThemeProvider on the server', () => {
  beforeEach(() => {
    vi.stubGlobal('window', undefined);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('runs without a window', () => {
    expect(typeof window).toBe('undefined');
  });

  it('renders the default mode and variant', () => {
    const html = renderToString(
      <ThemeProvider>
        <ThemeProbe />
      </ThemeProvider>,
    );
    expect(html).toContain('data-mode="dark"');
    expect(html).toContain('data-dark="true"');
  });

  it('renders the given defaults and ignores setters without storage', () => {
    const html = renderToString(
      <ThemeProvider defaultMode="light" defaultVariant="slate">
        <ThemeProbe writeColors />
      </ThemeProvider>,
    );
    expect(html).toContain('data-mode="light"');
    expect(html).toContain('data-variant="slate"');
    expect(html).toContain('data-dark="false"');
  });

  it('throws when useTheme is used outside a ThemeProvider', () => {
    expect(() => renderToString(<ThemeProbe />)).toThrow('useTheme must be used within a ThemeProvider');
  });
});
