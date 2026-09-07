"use client";

import { useEffect, useState } from "react";

export interface KeycloakUserInfo {
  id?: string;
  username: string;
  name: string;
  email?: string;
  avatarInitials: string;
  logout: () => void;
}

export function useKeycloakUser(): KeycloakUserInfo {
  const [userInfo, setUserInfo] = useState<KeycloakUserInfo>({
    id: undefined,
    username: "User",
    name: "User",
    avatarInitials: "U",
    logout: () => {
      if (typeof window !== "undefined") {
        sessionStorage.removeItem("token_shopping-frontend");
        window.location.href = window.location.origin;
      }
    },
  });

  useEffect(() => {
    if (typeof window === "undefined") return;
    const updateFromKeycloak = () => {
      const keycloak = (window as unknown as {
        __keycloak_instance__?: {
          tokenParsed?: {
            sub?: string;
            preferred_username?: string;
            given_name?: string;
            name?: string;
            email?: string;
          };
          logout?: (options?: { redirectUri?: string }) => void;
        };
      }).__keycloak_instance__;
      if (keycloak && keycloak.tokenParsed) {
        const id = keycloak.tokenParsed.sub;
        const username =
          keycloak.tokenParsed.preferred_username ||
          keycloak.tokenParsed.given_name ||
          "User";
        const name = keycloak.tokenParsed.name || username;
        const email = keycloak.tokenParsed.email;
        const initials = (name || username || "U")
          .split(" ")
          .map((n: string) => n[0])
          .join("")
          .toUpperCase()
          .slice(0, 2);

        setUserInfo({
          id,
          username,
          name,
          email,
          avatarInitials: initials || "U",
          logout: () => {
            if (typeof window !== "undefined") {
              sessionStorage.removeItem("token_shopping-frontend");
            }
            if (keycloak && typeof keycloak.logout === "function") {
              keycloak.logout({ redirectUri: window.location.origin });
            } else {
              if (typeof window !== "undefined") {
                window.location.href = window.location.origin;
              }
            }
          },
        });
      }
    };

    updateFromKeycloak();
    const timer = setInterval(updateFromKeycloak, 2000);
    return () => clearInterval(timer);
  }, []);

  return userInfo;
}
