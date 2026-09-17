import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { renderToString } from 'react-dom/server';
import { AuthGuard } from '../AuthGuard';
import { discoverProviderMetadata, resetDiscoveryCacheForTests } from '../oidcFlow';
import { IssuerUnreachableError } from '../oidcTypes';

const ISSUER = 'https://auth.example';
const DISCOVERY_URL = 'https://auth.example/.well-known/openid-configuration';

describe('unreachable OIDC issuer', () => {
  const originalLocation = window.location;
  const originalSecureContext = Object.getOwnPropertyDescriptor(window, 'isSecureContext');

  function setWindowLocation(href: string) {
    const url = new URL(href);
    Object.defineProperty(window, 'location', {
      value: {
        href: url.href,
        origin: url.origin,
        host: url.host,
        pathname: url.pathname,
        search: url.search,
        hash: url.hash,
        assign: vi.fn(),
      },
      writable: true,
      configurable: true,
    });
  }

  function renderGuard() {
    return render(
      <AuthGuard basePath="/pantry">
        <div data-testid="protected-content">secret dashboard data</div>
      </AuthGuard>,
    );
  }

  beforeEach(() => {
    sessionStorage.clear();
    resetDiscoveryCacheForTests();
    Object.defineProperty(window, 'isSecureContext', { value: true, configurable: true });
    setWindowLocation('https://alfheim.example/pantry');
    (window as any).__ALFHEIM_ENV__ = { OIDC_ISSUER: ISSUER, OIDC_CLIENT_ID: 'alfheim-frontend' };
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    Object.defineProperty(window, 'location', { value: originalLocation, writable: true, configurable: true });
    if (originalSecureContext) {
      Object.defineProperty(window, 'isSecureContext', originalSecureContext);
    } else {
      delete (window as any).isSecureContext;
    }
    delete (window as any).__ALFHEIM_ENV__;
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  describe('discoverProviderMetadata', () => {
    it('raises IssuerUnreachableError when fetch rejects with a TypeError for a cross-host https issuer', async () => {
      const cause = new TypeError('Failed to fetch');
      vi.stubGlobal('fetch', vi.fn(() => Promise.reject(cause)));

      const err = await discoverProviderMetadata(ISSUER).catch((e: unknown) => e);

      expect(err).toBeInstanceOf(IssuerUnreachableError);
      const typed = err as IssuerUnreachableError;
      expect(typed.name).toBe('IssuerUnreachableError');
      expect(typed.issuerUrl).toBe(ISSUER);
      expect(typed.discoveryUrl).toBe(DISCOVERY_URL);
      expect(typed.issuerHost).toBe('auth.example');
      expect(typed.message).toContain('https://auth.example could not be reached');
      expect(typed.message).toContain('certificate for auth.example');
      expect(typed.message).toContain('identity provider may be down');
      expect((typed as { cause?: unknown }).cause).toBe(cause);
    });

    it('keeps the plain TypeError when the issuer is on the same host as the app', async () => {
      setWindowLocation('https://auth.example/pantry');
      vi.stubGlobal('fetch', vi.fn(() => Promise.reject(new TypeError('Failed to fetch'))));

      const err = await discoverProviderMetadata(ISSUER).catch((e: unknown) => e);

      expect(err).toBeInstanceOf(TypeError);
      expect(err).not.toBeInstanceOf(IssuerUnreachableError);
    });

    it('keeps the plain TypeError for a plain-http issuer', async () => {
      vi.stubGlobal('fetch', vi.fn(() => Promise.reject(new TypeError('Failed to fetch'))));

      const err = await discoverProviderMetadata('http://auth.example').catch((e: unknown) => e);

      expect(err).not.toBeInstanceOf(IssuerUnreachableError);
    });

    it('keeps the existing status error for an HTTP 500 discovery response', async () => {
      vi.stubGlobal('fetch', vi.fn(() => Promise.resolve({ ok: false, status: 500 } as Response)));

      const err = await discoverProviderMetadata(ISSUER).catch((e: unknown) => e);

      expect(err).not.toBeInstanceOf(IssuerUnreachableError);
      expect((err as Error).message).toBe('OIDC discovery failed with status 500');
    });
  });

  describe('AuthGuard', () => {
    it('renders the certificate hint with a new-tab link to the discovery URL', async () => {
      vi.stubGlobal('fetch', vi.fn(() => Promise.reject(new TypeError('Failed to fetch'))));

      renderGuard();

      expect(await screen.findByRole('alert')).toBeInTheDocument();
      expect(screen.getByRole('heading', { name: 'Sign-in service not reachable' })).toBeInTheDocument();
      expect(screen.queryByText(/Identity provider not reachable or misconfigured/i)).not.toBeInTheDocument();
      expect(screen.queryByText(/Failed to fetch/)).not.toBeInTheDocument();
      const link = screen.getByRole('link', { name: /auth\.example/ });
      expect(link).toHaveAttribute('href', DISCOVERY_URL);
      expect(link).toHaveAttribute('target', '_blank');
      expect(link).toHaveAttribute('rel', 'noopener noreferrer');
      expect(screen.getByText(/reload the page/i)).toBeInTheDocument();
      expect(screen.queryByTestId('protected-content')).not.toBeInTheDocument();
    });

    it('keeps the generic error page for an HTTP 500 discovery response', async () => {
      vi.stubGlobal('fetch', vi.fn(() => Promise.resolve({ ok: false, status: 500 } as Response)));

      renderGuard();

      expect(await screen.findByRole('alert')).toBeInTheDocument();
      expect(screen.getByRole('heading', { name: /Identity provider not reachable or misconfigured/i })).toBeInTheDocument();
      expect(screen.getByText('OIDC discovery failed with status 500')).toBeInTheDocument();
      expect(screen.queryByRole('link')).not.toBeInTheDocument();
    });

    it('renders only the neutral loader on the server', () => {
      const html = renderToString(
        <AuthGuard basePath="/pantry">
          <div data-testid="protected-content">secret dashboard data</div>
        </AuthGuard>,
      );

      expect(html).toContain('data-alfheim-auth-guard="pending"');
      expect(html).not.toContain('Sign-in service not reachable');
    });
  });
});
