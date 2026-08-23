"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Keycloak from "keycloak-js";
import { UserProfile } from "./AuthContext";

export function useMaintenanceKeycloak() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [user, setUser] = useState<UserProfile | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [keycloakInstance, setKeycloakInstance] = useState<Keycloak | null>(null);

  const extractUserProfile = useCallback((keycloak: Keycloak): UserProfile => {
    const tokenParsed = keycloak.tokenParsed as Record<string, any> | undefined;
    const name =
      tokenParsed?.name ||
      tokenParsed?.preferred_username ||
      tokenParsed?.email ||
      "Maintenance User";
    const username = tokenParsed?.preferred_username || name;
    const email = tokenParsed?.email;

    const roles: string[] = tokenParsed?.realm_access?.roles || [];
    const role = roles.includes("admin")
      ? "Administrator"
      : "Maintenance Technician";

    const initials =
      name
        .split(" ")
        .filter(Boolean)
        .map((part: string) => part[0].toUpperCase())
        .slice(0, 2)
        .join("") || "MU";

    return { name, username, email, role, initials };
  }, []);

  const initializedRef = useRef(false);
  const refreshIntervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    let isMounted = true;
    if (typeof window === "undefined") return;
    if (!initializedRef.current) {
      initializedRef.current = true;

      const keycloak = new Keycloak({
        url: process.env.NEXT_PUBLIC_KEYCLOAK_URL || "http://api.alfheim.loegien.localhost/auth",
        realm: "alfheim",
        clientId: "maintenance-frontend",
      });

      setKeycloakInstance(keycloak);
      (window as any).__keycloak_instance__ = keycloak;

      const cleanQueryParams = () => {
        if (typeof window !== "undefined") {
          const url = new URL(window.location.href);
          let hasParams = false;
          ["state", "session_state", "code", "iss"].forEach((param) => {
            if (url.searchParams.has(param)) {
              url.searchParams.delete(param);
              hasParams = true;
            }
          });
          if (hasParams) {
            window.history.replaceState({}, document.title, url.pathname + url.search);
          }
        }
      };

      keycloak
        .init({
          onLoad: "login-required",
          checkLoginIframe: false,
          pkceMethod: "S256",
          responseMode: "query",
        })
        .then((authenticated) => {
          cleanQueryParams();
          if (!isMounted) return;
          if (authenticated && keycloak.token) {
            setIsAuthenticated(true);
            const currentToken = keycloak.token || "";
            setToken(currentToken);
            sessionStorage.setItem("token_maintenance-frontend", currentToken);
            sessionStorage.setItem("alfheim_access_token", currentToken);
            setUser(extractUserProfile(keycloak));

            refreshIntervalRef.current = setInterval(() => {
              keycloak
                .updateToken(70)
                .then((refreshed) => {
                  if (refreshed && keycloak.token) {
                    const newToken = keycloak.token || "";
                    setToken(newToken);
                    sessionStorage.setItem("token_maintenance-frontend", newToken);
                    sessionStorage.setItem("alfheim_access_token", newToken);
                    setUser(extractUserProfile(keycloak));
                  }
                })
                .catch(() => {
                  console.error("Failed to refresh Keycloak token");
                });
            }, 60000);
          } else {
            setIsAuthenticated(false);
          }
        })
        .catch((err) => {
          console.error("Keycloak initialization failed", err);
          cleanQueryParams();
          if (isMounted) {
            setAuthError("Failed to connect to Keycloak auth service.");
          }
        });
    }

    return () => {
      isMounted = false;
      if (refreshIntervalRef.current) {
        clearInterval(refreshIntervalRef.current);
        refreshIntervalRef.current = null;
      }
    };
  }, [extractUserProfile]);

  const handleLogout = useCallback(() => {
    if (keycloakInstance) {
      sessionStorage.removeItem("token_maintenance-frontend");
      setToken(null);
      setUser(null);
      setIsAuthenticated(false);
      keycloakInstance.logout({
        redirectUri: window.location.origin,
      });
    }
  }, [keycloakInstance]);

  return {
    isAuthenticated,
    authError,
    user,
    token,
    handleLogout,
  };
}
