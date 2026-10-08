'use client';

import React, { ReactNode } from 'react';
import { useTranslation } from '../../i18n/utils/useTranslation';

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error?: Error;
}

/** Translated fallback UI; a function component so it can use the translation hook. */
function ErrorFallback({ error, onRetry }: { error?: Error; onRetry: () => void }) {
  const { t } = useTranslation();

  return (
    <div className="flex-1 flex flex-col items-center justify-center p-8 gap-4 text-center">
      <div className="glass-card max-w-md p-6 rounded-2xl border border-red-500/20 space-y-4">
        <div className="h-12 w-12 rounded-xl bg-red-500/10 text-red-400 flex items-center justify-center mx-auto text-xl font-bold">
          !
        </div>
        <h2 className="text-lg font-bold text-foreground uppercase tracking-wide">
          {t('common.error_boundary.title')}
        </h2>
        <p className="text-xs text-muted-foreground">
          {error?.message || t('common.error_boundary.description')}
        </p>
        <button
          type="button"
          onClick={onRetry}
          className="px-4 py-2 rounded-xl bg-primary text-primary-foreground font-heading text-xs font-extrabold uppercase tracking-wider transition-colors cursor-pointer hover:opacity-90"
        >
          {t('common.error_boundary.retry')}
        </button>
      </div>
    </div>
  );
}

export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('[ErrorBoundary] Uncaught error:', error);
    console.error('[ErrorBoundary] Error info:', errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <ErrorFallback
          error={this.state.error}
          onRetry={() => this.setState({ hasError: false, error: undefined })}
        />
      );
    }

    return this.props.children;
  }
}
