'use client';

import React, { ReactNode } from 'react';
import { useOidcAuth, type UseOidcAuthOptions } from './useOidcAuth';
import { AuthContext } from './authContext';

export interface AuthGuardProps extends UseOidcAuthOptions {
  children: ReactNode;
  /** Overrides the default neutral loading state. */
  loadingFallback?: ReactNode;
}

function DefaultLoader() {
  return (
    <div
      role="status"
      aria-live="polite"
      data-alfheim-auth-guard="pending"
      style={{
        display: 'flex',
        height: '100vh',
        width: '100%',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'var(--surface-canvas, #0b0f14)',
        color: 'var(--text-main, #f5f5f5)',
      }}
    >
      <div
        aria-hidden
        style={{
          height: 40,
          width: 40,
          borderRadius: '9999px',
          border: '4px solid var(--primary-main, #22c55e)',
          borderTopColor: 'transparent',
          animation: 'alfheim-auth-guard-spin 0.8s linear infinite',
        }}
      />
      <style>{`@keyframes alfheim-auth-guard-spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

function AuthErrorPage({
  detail,
  title = 'Identity provider not reachable or misconfigured',
  action,
}: {
  detail: string;
  title?: string;
  action?: { href: string; label: string };
}) {
  return (
    <div
      role="alert"
      style={{
        display: 'flex',
        height: '100vh',
        width: '100%',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'var(--surface-canvas, #0b0f14)',
        color: 'var(--text-main, #f5f5f5)',
        padding: '1.5rem',
      }}
    >
      <div style={{ maxWidth: 420, textAlign: 'center' }}>
        <h1 style={{ fontSize: '1.125rem', fontWeight: 700, marginBottom: '0.5rem' }}>
          {title}
        </h1>
        <p style={{ fontSize: '0.875rem', opacity: 0.75 }}>{detail}</p>
        {action && (
          <p style={{ fontSize: '0.875rem', marginTop: '1rem' }}>
            <a
              href={action.href}
              style={{ color: 'var(--primary-main, #22c55e)', fontWeight: 600, textDecoration: 'underline' }}
            >
              {action.label}
            </a>
          </p>
        )}
      </div>
    </div>
  );
}

/**
 * Gates all rendered content behind a validated OIDC session.
 *
 * Renders nothing but a neutral loader until a valid session exists, then starts
 * an interactive login redirect. On a configuration or discovery failure it
 * renders an explicit error page instead of ever falling through to the app shell.
 */
export function AuthGuard({ basePath = '', children, loadingFallback }: AuthGuardProps) {
  const auth = useOidcAuth({ basePath });

  if (auth.configError) {
    return <AuthErrorPage detail={auth.configError.message} />;
  }

  if (auth.insecureContextError) {
    const { httpsUrl, message } = auth.insecureContextError;
    return (
      <AuthErrorPage
        title="Secure connection (HTTPS) required"
        detail={message}
        action={{ href: httpsUrl, label: `Open ${httpsUrl}` }}
      />
    );
  }

  if (auth.discoveryError) {
    return <AuthErrorPage detail={auth.discoveryError} />;
  }

  if (auth.isLoading || !auth.isAuthenticated) {
    // The marker on the wrapper (not just DefaultLoader) guarantees the check
    // script's invariant holds even if a caller supplies its own loadingFallback.
    return <div data-alfheim-auth-guard="pending">{loadingFallback ?? <DefaultLoader />}</div>;
  }

  return (
    <AuthContext.Provider
      value={{
        user: auth.user,
        token: auth.token,
        isAuthenticated: auth.isAuthenticated,
        isLoading: auth.isLoading,
        logout: auth.logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}
