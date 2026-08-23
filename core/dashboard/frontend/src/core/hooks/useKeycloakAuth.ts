'use client';

import { useEffect, useRef, useState } from 'react';
import Keycloak from 'keycloak-js';
import { UserIdentityClaims, setInMemoryToken } from '../providers/AuthProvider';

export function useKeycloakAuth() {
  const [user, setUser] = useState<UserIdentityClaims | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [keycloakInstance, setKeycloakInstance] = useState<Keycloak | null>(null);
  const initializedRef = useRef<boolean>(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (initializedRef.current) return;
    initializedRef.current = true;

    const keycloak = new Keycloak({
      url: process.env.NEXT_PUBLIC_KEYCLOAK_URL || 'http://api.alfheim.loegien.localhost/auth',
      realm: process.env.NEXT_PUBLIC_KEYCLOAK_REALM || 'alfheim',
      clientId: process.env.NEXT_PUBLIC_KEYCLOAK_CLIENT_ID || 'dashboard-frontend',
    });

    setKeycloakInstance(keycloak);
    (window as any).__keycloak_instance__ = keycloak;

    keycloak
      .init({
        onLoad: 'login-required',
        checkLoginIframe: false,
        pkceMethod: 'S256',
        responseMode: 'query',
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

          setInMemoryToken(keycloak.token);
          if (typeof window !== 'undefined') {
            sessionStorage.setItem("alfheim_access_token", keycloak.token);
            sessionStorage.setItem("token_dashboard-frontend", keycloak.token);
          }
          setToken(keycloak.token);
          setUser(userClaims);
          setIsAuthenticated(true);

          if (typeof window !== 'undefined') {
            const url = new URL(window.location.href);
            let hasParams = false;
            ['state', 'session_state', 'code', 'iss'].forEach((param) => {
              if (url.searchParams.has(param)) {
                url.searchParams.delete(param);
                hasParams = true;
              }
            });
            if (hasParams) {
              window.history.replaceState({}, document.title, url.pathname + url.search);
            }
          }

          const interval = setInterval(() => {
            keycloak
              .updateToken(70)
              .then((refreshed) => {
                if (refreshed && keycloak.token) {
                  setInMemoryToken(keycloak.token);
                  if (typeof window !== 'undefined') {
                    sessionStorage.setItem("alfheim_access_token", keycloak.token);
                    sessionStorage.setItem("token_dashboard-frontend", keycloak.token);
                  }
                  setToken(keycloak.token);
                }
              })
              .catch((err) => {
                console.error('Failed to refresh Keycloak token', err);
                keycloak.login();
              });
          }, 60000);

          setIsLoading(false);
          return () => clearInterval(interval);
        } else {
          setInMemoryToken(null);
          setIsAuthenticated(false);
          setIsLoading(false);
        }
      })
      .catch((err) => {
        console.error('Keycloak authentication initialization failed:', err);
        setInMemoryToken(null);
        if (typeof window !== 'undefined') {
          const url = new URL(window.location.href);
          let hasParams = false;
          ['state', 'session_state', 'code', 'iss'].forEach((param) => {
            if (url.searchParams.has(param)) {
              url.searchParams.delete(param);
              hasParams = true;
            }
          });
          if (hasParams) {
            window.history.replaceState({}, document.title, url.pathname + url.search);
          }
        }
        setIsLoading(false);
      });
  }, []);

  return {
    user,
    token,
    isAuthenticated,
    isLoading,
    keycloakInstance,
    setUser,
    setToken,
    setIsAuthenticated,
  };
}
