import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { renderToString } from 'react-dom/server';
import { AuthGuard } from '../AuthGuard';
import { beginLogin, detectInsecureContext, resetDiscoveryCacheForTests } from '../oidcFlow';
import { InsecureContextError } from '../oidcTypes';

const OIDC_CONFIG = {
  issuer: 'https://auth.alfheim.example',
  clientId: 'alfheim-frontend',
  redirectUri: 'http://alfheim.example/pantry',
  scope: 'openid profile email',
};

describe('insecure context guard', () => {
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

  function setSecureContext(secure: boolean) {
    Object.defineProperty(window, 'isSecureContext', { value: secure, configurable: true });
  }

  beforeEach(() => {
    sessionStorage.clear();
    delete (window as any).__ALFHEIM_ENV__;
    resetDiscoveryCacheForTests();
  });

  afterEach(() => {
    Object.defineProperty(window, 'location', { value: originalLocation, writable: true, configurable: true });
    if (originalSecureContext) {
      Object.defineProperty(window, 'isSecureContext', originalSecureContext);
    } else {
      delete (window as any).isSecureContext;
    }
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  describe('detectInsecureContext', () => {
    it('returns a typed error with an actionable https URL on a plain-HTTP origin', () => {
      setWindowLocation('http://alfheim.example:8080/pantry?tab=1#top');
      setSecureContext(false);

      const err = detectInsecureContext();

      expect(err).toBeInstanceOf(InsecureContextError);
      expect(err?.name).toBe('InsecureContextError');
      expect(err?.host).toBe('alfheim.example:8080');
      expect(err?.httpsUrl).toBe('https://alfheim.example:8080/pantry?tab=1#top');
      expect(err?.message).toContain('Sign-in requires HTTPS');
      expect(err?.message).toContain('Open https://alfheim.example:8080/pantry?tab=1#top instead.');
    });

    it('reports an insecure context when crypto.subtle is missing even without the flag', () => {
      setWindowLocation('http://alfheim.example/pantry');
      vi.stubGlobal('crypto', { getRandomValues: crypto.getRandomValues.bind(crypto) });

      expect(detectInsecureContext()).toBeInstanceOf(InsecureContextError);
    });

    it('returns null in a secure context', () => {
      setWindowLocation('https://alfheim.example/pantry');
      setSecureContext(true);

      expect(detectInsecureContext()).toBeNull();
    });
  });

  describe('beginLogin', () => {
    it('throws InsecureContextError before any discovery request instead of a crypto TypeError', async () => {
      setWindowLocation('http://alfheim.example/pantry');
      setSecureContext(false);
      const fetchMock = vi.fn();
      vi.stubGlobal('fetch', fetchMock);

      await expect(beginLogin(OIDC_CONFIG)).rejects.toBeInstanceOf(InsecureContextError);
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it('still redirects to the authorize endpoint in a secure context', async () => {
      setWindowLocation('https://alfheim.example/pantry');
      setSecureContext(true);
      vi.stubGlobal(
        'fetch',
        vi.fn(() =>
          Promise.resolve({
            ok: true,
            json: () =>
              Promise.resolve({
                issuer: OIDC_CONFIG.issuer,
                authorization_endpoint: 'https://auth.alfheim.example/oauth/v2/authorize',
                token_endpoint: 'https://auth.alfheim.example/oauth/v2/token',
                jwks_uri: 'https://auth.alfheim.example/oauth/v2/keys',
              }),
          } as Response),
        ),
      );

      await beginLogin(OIDC_CONFIG);

      expect(window.location.assign).toHaveBeenCalledWith(
        expect.stringContaining('https://auth.alfheim.example/oauth/v2/authorize?'),
      );
      expect(window.location.assign).toHaveBeenCalledWith(expect.stringContaining('code_challenge_method=S256'));
    });
  });

  describe('AuthGuard', () => {
    beforeEach(() => {
      (window as any).__ALFHEIM_ENV__ = {
        OIDC_ISSUER: OIDC_CONFIG.issuer,
        OIDC_CLIENT_ID: OIDC_CONFIG.clientId,
      };
    });

    it('explains the HTTPS requirement with a link to the https URL, without contacting the IdP', async () => {
      setWindowLocation('http://alfheim.example/pantry');
      setSecureContext(false);
      const fetchMock = vi.fn();
      vi.stubGlobal('fetch', fetchMock);

      render(
        <AuthGuard basePath="/pantry">
          <div data-testid="protected-content">secret dashboard data</div>
        </AuthGuard>,
      );

      expect(await screen.findByRole('alert')).toBeInTheDocument();
      expect(screen.getByRole('heading', { name: /HTTPS.*required/i })).toBeInTheDocument();
      expect(screen.queryByText(/Identity provider not reachable/i)).not.toBeInTheDocument();
      expect(screen.queryByText(/digest/i)).not.toBeInTheDocument();
      const link = screen.getByRole('link', { name: /https:\/\/alfheim\.example\/pantry/ });
      expect(link).toHaveAttribute('href', 'https://alfheim.example/pantry');
      expect(screen.queryByTestId('protected-content')).not.toBeInTheDocument();
      expect(fetchMock).not.toHaveBeenCalled();
      expect(window.location.assign).not.toHaveBeenCalled();
    });

    it('keeps the unchanged loading and login behavior in a secure context', async () => {
      setWindowLocation('https://alfheim.example/pantry');
      setSecureContext(true);
      vi.stubGlobal('fetch', vi.fn(() => new Promise(() => {})));

      render(
        <AuthGuard basePath="/pantry">
          <div data-testid="protected-content">secret dashboard data</div>
        </AuthGuard>,
      );

      await waitFor(() => expect(screen.getByRole('status')).toBeInTheDocument());
      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
      expect(screen.queryByTestId('protected-content')).not.toBeInTheDocument();
    });

    it('renders only the neutral loader on the server even when the client will be insecure', () => {
      setWindowLocation('http://alfheim.example/pantry');
      setSecureContext(false);

      const html = renderToString(
        <AuthGuard basePath="/pantry">
          <div data-testid="protected-content">secret dashboard data</div>
        </AuthGuard>,
      );

      expect(html).toContain('data-alfheim-auth-guard="pending"');
      expect(html).not.toContain('HTTPS');
    });
  });
});
