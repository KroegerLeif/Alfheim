import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderToString } from 'react-dom/server';
import { render, screen } from '@testing-library/react';
import { AuthGuard } from '../AuthGuard';
import { resetDiscoveryCacheForTests } from '../oidcFlow';

/**
 * Regression test for the hydration-mismatch bug: with no OIDC env configured,
 * useOidcAuth used to call loadOidcConfig() synchronously during render. On the
 * server (and the client's first paint, before any effect has run) that threw
 * OidcConfigError, so AuthGuard rendered its "Identity provider not reachable"
 * error page straight into prerendered HTML - even though config is only known
 * to be missing after mount. Config resolution now happens exclusively in a
 * useEffect, so the server render and the client's first render must be
 * identical: the neutral loader, nothing else.
 */
describe('AuthGuard server render', () => {
  beforeEach(() => {
    sessionStorage.clear();
    delete (window as any).__ALFHEIM_ENV__;
    resetDiscoveryCacheForTests();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders only the neutral loader on the server, never the error page, with no OIDC env configured', () => {
    // No window.__ALFHEIM_ENV__: this is exactly the "no OIDC env at build time" case.
    const html = renderToString(
      <AuthGuard basePath="/pantry">
        <div data-testid="protected-content">secret dashboard data</div>
      </AuthGuard>,
    );

    expect(html).toContain('data-alfheim-auth-guard="pending"');
    expect(html).not.toContain('Identity provider not reachable');
    expect(html).not.toContain('protected-content');
    expect(html).not.toContain('secret dashboard data');
  });

  it("matches the client's first render (pre-effect) exactly, so hydration cannot mismatch", () => {
    const serverHtml = renderToString(
      <AuthGuard basePath="/pantry">
        <div data-testid="protected-content">secret dashboard data</div>
      </AuthGuard>,
    );

    // React effects (and therefore config resolution) never run during
    // renderToString, which is what makes this comparable to the client's
    // first paint before useEffect has fired.
    expect(serverHtml).toContain('data-alfheim-auth-guard="pending"');
    expect(serverHtml).not.toContain('Identity provider not reachable');
  });

  it('resolves config only from an effect: the error page appears after mount, never during the initial render', async () => {
    // renderToString never runs effects, so it reflects exactly what the DOM
    // looks like the instant before any effect fires - i.e. what a real
    // browser paints first, before hydration's effects run.
    const preEffectHtml = renderToString(
      <AuthGuard basePath="/pantry">
        <div data-testid="protected-content">secret dashboard data</div>
      </AuthGuard>,
    );
    expect(preEffectHtml).toContain('data-alfheim-auth-guard="pending"');
    expect(preEffectHtml).not.toContain('Identity provider not reachable');

    // Once mounted in a real DOM, the effect runs, resolves the empty config,
    // and only then does the error page replace the loader.
    render(
      <AuthGuard basePath="/pantry">
        <div data-testid="protected-content">secret dashboard data</div>
      </AuthGuard>,
    );
    expect(await screen.findByRole('alert')).toBeInTheDocument();
    expect(screen.getByText(/misconfigured/i)).toBeInTheDocument();
    expect(screen.queryByTestId('protected-content')).not.toBeInTheDocument();
  });
});
