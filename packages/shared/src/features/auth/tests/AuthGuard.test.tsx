import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { AuthGuard } from '../AuthGuard';
import { resetDiscoveryCacheForTests } from '../oidcFlow';

describe('AuthGuard', () => {
  const originalLocation = window.location;

  beforeEach(() => {
    sessionStorage.clear();
    delete (window as any).__ALFHEIM_ENV__;
    resetDiscoveryCacheForTests();
  });

  afterEach(() => {
    Object.defineProperty(window, 'location', { value: originalLocation, writable: true });
    vi.restoreAllMocks();
  });

  function setWindowLocation(href: string) {
    const url = new URL(href);
    Object.defineProperty(window, 'location', {
      value: {
        href: url.href,
        origin: url.origin,
        pathname: url.pathname,
        search: url.search,
        assign: vi.fn(),
      },
      writable: true,
    });
  }

  it('renders an explicit error page, never the app shell, when the OIDC config is missing', async () => {
    setWindowLocation('https://alfheim.loegien.de/pantry');
    // No __ALFHEIM_ENV__ set: issuer/client id are empty.

    render(
      <AuthGuard basePath="/pantry">
        <div data-testid="protected-content">secret dashboard data</div>
      </AuthGuard>,
    );

    expect(await screen.findByRole('alert')).toBeInTheDocument();
    expect(screen.getByText(/misconfigured/i)).toBeInTheDocument();
    expect(screen.queryByTestId('protected-content')).not.toBeInTheDocument();
  });

  it('renders only a neutral loader, never the children, before a session is established', async () => {
    setWindowLocation('https://alfheim.loegien.de/pantry');
    (window as any).__ALFHEIM_ENV__ = {
      OIDC_ISSUER: 'https://auth.alfheim.loegien.de',
      OIDC_CLIENT_ID: 'alfheim-frontend',
    };
    // No fetch mock: discovery never resolves within this test, so the guard must
    // stay in the loading state and never render protected content.
    vi.stubGlobal('fetch', vi.fn(() => new Promise(() => {})));

    render(
      <AuthGuard basePath="/pantry">
        <div data-testid="protected-content">secret dashboard data</div>
      </AuthGuard>,
    );

    await waitFor(() => expect(screen.getByRole('status')).toBeInTheDocument());
    expect(screen.queryByTestId('protected-content')).not.toBeInTheDocument();
  });

  it('renders an error page when OIDC discovery fails against a reachable-but-broken issuer', async () => {
    setWindowLocation('https://alfheim.loegien.de/pantry');
    (window as any).__ALFHEIM_ENV__ = {
      OIDC_ISSUER: 'https://auth.alfheim.loegien.de',
      OIDC_CLIENT_ID: 'alfheim-frontend',
    };
    vi.stubGlobal('fetch', vi.fn(() => Promise.resolve({ ok: false, status: 500 } as Response)));

    render(
      <AuthGuard basePath="/pantry">
        <div data-testid="protected-content">secret dashboard data</div>
      </AuthGuard>,
    );

    expect(await screen.findByRole('alert')).toBeInTheDocument();
    expect(screen.queryByTestId('protected-content')).not.toBeInTheDocument();
  });
});
