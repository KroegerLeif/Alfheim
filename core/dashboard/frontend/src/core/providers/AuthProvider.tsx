'use client';

import React, { createContext, useContext, ReactNode } from 'react';
import { useKeycloakAuth } from '../hooks/useKeycloakAuth';

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

let inMemoryToken: string | null = null;

export function getInMemoryToken(): string | null {
  if (inMemoryToken) return inMemoryToken;
  if (typeof window !== "undefined") {
    return sessionStorage.getItem("token_dashboard-frontend");
  }
  return null;
}

export function setInMemoryToken(token: string | null) {
  inMemoryToken = token;
  if (typeof window !== "undefined") {
    if (token) {
      sessionStorage.setItem("token_dashboard-frontend", token);
    } else {
      sessionStorage.removeItem("token_dashboard-frontend");
    }
  }
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
  const {
    user,
    token,
    isAuthenticated,
    isLoading,
    keycloakInstance,
    setUser,
    setToken,
    setIsAuthenticated,
  } = useKeycloakAuth();

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
