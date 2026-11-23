import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { AuthGuard } from '../AuthGuard';
import type { OidcAuthState } from '../useOidcAuth';

const auth = vi.hoisted(() => ({ useOidcAuth: vi.fn() }));
vi.mock('../useOidcAuth', () => auth);

const SIGNED_OUT: OidcAuthState = {
  user: null,
  token: null,
  isAuthenticated: false,
  isLoading: false,
  configError: null,
  discoveryError: null,
  insecureContextError: null,
  issuerUnreachableError: null,
  login: () => undefined,
  logout: () => undefined,
};

describe('AuthGuard session states', () => {
  it('keeps showing the pending loader after loading ends without a session', () => {
    auth.useOidcAuth.mockReturnValue(SIGNED_OUT);
    const { container } = render(
      <AuthGuard loadingFallback={<span>waiting</span>}>
        <div data-testid="protected-content">secret</div>
      </AuthGuard>,
    );
    expect(container.querySelector('[data-alfheim-auth-guard="pending"]')).not.toBeNull();
    expect(screen.getByText('waiting')).toBeInTheDocument();
    expect(screen.queryByTestId('protected-content')).not.toBeInTheDocument();
  });

  it('renders the children once a session is established', () => {
    auth.useOidcAuth.mockReturnValue({ ...SIGNED_OUT, isAuthenticated: true, token: 'token' });
    render(
      <AuthGuard>
        <div data-testid="protected-content">secret</div>
      </AuthGuard>,
    );
    expect(screen.getByTestId('protected-content')).toBeInTheDocument();
  });
});
