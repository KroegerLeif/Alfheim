import { render, screen } from '@testing-library/react';
import { useQueryClient } from '@tanstack/react-query';
import { describe, expect, it } from 'vitest';
import { LanguageProvider } from '../../i18n/utils/LanguageContext';
import { useTheme } from '../../theme/hooks/useTheme';
import { AppLoading, AppProviders, createAppQueryClient } from '..';

function QueryProbe() {
  const client = useQueryClient();
  return <span>retry:{String(client.getDefaultOptions().queries?.retry)}</span>;
}

function ThemeProbe() {
  return <span>variant:{useTheme().variant}</span>;
}

describe('createAppQueryClient', () => {
  it('uses the shared query defaults', () => {
    const queries = createAppQueryClient().getDefaultOptions().queries;
    expect(queries).toMatchObject({ refetchOnWindowFocus: false, retry: 1, staleTime: 300000 });
  });
});

describe('AppProviders', () => {
  it('provides a query client without a theme provider by default', () => {
    render(<AppProviders><QueryProbe /></AppProviders>);
    expect(screen.getByText('retry:1')).toBeInTheDocument();
  });

  it('wraps the children in a theme provider with the given defaults', () => {
    render(
      <AppProviders theme={{ defaultMode: 'dark', defaultVariant: 'obsidian' }}>
        <ThemeProbe />
      </AppProviders>,
    );
    expect(screen.getByText('variant:obsidian')).toBeInTheDocument();
  });
});

describe('AppLoading', () => {
  it('announces the translated common message', () => {
    render(<LanguageProvider defaultLanguage="pl"><AppLoading /></LanguageProvider>);
    expect(screen.getByRole('status')).toHaveTextContent('Ładowanie...');
  });

  it('renders an app-specific message key', () => {
    render(<LanguageProvider defaultLanguage="en"><AppLoading messageKey="missing.key" /></LanguageProvider>);
    expect(screen.getByText('missing.key')).toBeInTheDocument();
  });
});
