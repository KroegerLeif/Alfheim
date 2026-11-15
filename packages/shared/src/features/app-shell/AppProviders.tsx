'use client';

import { QueryClientProvider, type QueryClient } from '@tanstack/react-query';
import { useState, type ReactNode } from 'react';
import { ThemeProvider } from '../theme/hooks/ThemeContext';
import type { ThemeMode, ThemeVariant } from '../theme/types';
import { createAppQueryClient } from './appQueryClient';

/** Theme defaults for apps that mount their own theme provider below the shell. */
export interface AppThemeDefaults {
  defaultMode?: ThemeMode;
  defaultVariant?: ThemeVariant;
}

/** Props of {@link AppProviders}. */
export interface AppProvidersProps {
  /** The app's own providers and the page content. */
  children: ReactNode;
  /** Wraps the children in a `ThemeProvider` with these defaults when set. */
  theme?: AppThemeDefaults;
  /** Builds the query client once per mount. Inject a test client here. */
  createQueryClient?: () => QueryClient;
}

/**
 * Non-auth providers of every app's `[locale]/providers.tsx`: TanStack Query and, optionally,
 * a theme provider. Authentication is handled by the shared `AuthGuard` in the locale layout;
 * app-specific providers go in as children.
 *
 * @example
 * <AppProviders><LayoutProvider>{children}</LayoutProvider></AppProviders>
 */
export function AppProviders({ children, theme, createQueryClient = createAppQueryClient }: AppProvidersProps) {
  const [queryClient] = useState(createQueryClient);
  const content = theme ? <ThemeProvider {...theme}>{children}</ThemeProvider> : children;
  return <QueryClientProvider client={queryClient}>{content}</QueryClientProvider>;
}
