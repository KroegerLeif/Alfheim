'use client';

import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import Keycloak from 'keycloak-js';

export interface UserIdentityClaims {
  sub: string;
  preferred_username: string;
  email: string;
  given_name?: string;
  family_name?: string;
  name?: string;
}

interface AuthContextType {
  user: UserIdentityClaims | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  token: null,
  isAuthenticated: false,
  isLoading: true,
  logout: () => {},
});

// In-memory token storage to avoid XSS vulnerabilities while allowing non-React API clients to access active token
let inMemoryToken: string | null = null;

export function getInMemoryToken(): string | null {
  return inMemoryToken;
}

export function parseInMemoryTokenClaims(): UserIdentityClaims | null {
  if (!inMemoryToken) return null;
  try {
    const parts = inMemoryToken.split('.');
    if (parts.length < 2) return null;
    const payload = JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')));
    return {
      sub: payload.sub || '',
      preferred_username: payload.preferred_username || payload.email || 'user',
      email: payload.email || '',
      given_name: payload.given_name || '',
      family_name: payload.family_name || '',
      name: payload.name || `${payload.given_name || ''} ${payload.family_name || ''}`.trim() || payload.preferred_username || 'User',
    };
  } catch {
    return null;
  }
}


export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<UserIdentityClaims | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [keycloakInstance, setKeycloakInstance] = useState<Keycloak | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const keycloak = new Keycloak({
      url: process.env.NEXT_PUBLIC_KEYCLOAK_URL || 'http://loeger-os/auth',
      realm: process.env.NEXT_PUBLIC_KEYCLOAK_REALM || 'loeger-os',
      clientId: process.env.NEXT_PUBLIC_KEYCLOAK_CLIENT_ID || 'dashboard-frontend',
    });

    setKeycloakInstance(keycloak);

    keycloak
      .init({
        onLoad: 'login-required',
        checkLoginIframe: false,
        pkceMethod: 'S256',
      })
      .then((authenticated) => {
        if (authenticated && keycloak.token && keycloak.tokenParsed) {
          const parsed = keycloak.tokenParsed as Record<string, string>;
          const userClaims: UserIdentityClaims = {
            sub: parsed.sub || '',
            preferred_username: parsed.preferred_username || parsed.email || 'User',
            email: parsed.email || '',
            given_name: parsed.given_name || '',
            family_name: parsed.family_name || '',
            name: parsed.name || `${parsed.given_name || ''} ${parsed.family_name || ''}`.trim() || parsed.preferred_username || 'User',
          };

          inMemoryToken = keycloak.token;
          setToken(keycloak.token);
          setUser(userClaims);
          setIsAuthenticated(true);

          // Setup automatic token refresh in memory
          const interval = setInterval(() => {
            keycloak
              .updateToken(70)
              .then((refreshed) => {
                if (refreshed && keycloak.token) {
                  inMemoryToken = keycloak.token;
                  setToken(keycloak.token);
                }
              })
              .catch((err) => {
                console.error('Failed to refresh Keycloak token', err);
              });
          }, 60000);

          setIsLoading(false);
          return () => clearInterval(interval);
        } else {
          inMemoryToken = null;
          setIsAuthenticated(false);
          setIsLoading(false);
        }
      })
      .catch((err) => {
        console.error('Keycloak authentication initialization failed:', err);
        inMemoryToken = null;
        setIsLoading(false);
      });
  }, []);

  const logout = () => {
    inMemoryToken = null;
    setToken(null);
    setUser(null);
    setIsAuthenticated(false);
    if (keycloakInstance) {
      keycloakInstance.logout({
        redirectUri: typeof window !== 'undefined' ? window.location.origin : undefined,
      });
    }
  };

  if (isLoading) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-[var(--surface-canvas)] text-[var(--text-main)]">
        <div className="text-center space-y-4">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-[var(--primary-main)] border-t-transparent mx-auto"></div>
          <p className="text-sm font-mono tracking-wide text-[var(--text-muted)]">
            Authenticating session with Keycloak OIDC...
          </p>
        </div>
      </div>
    );
  }

  return (
    <AuthContext.Provider value={{ user, token, isAuthenticated, isLoading, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextType {
  return useContext(AuthContext);
}
