"use client";

import { useEffect, useState } from "react";

export interface KeycloakUserInfo {
  username: string;
  name: string;
  email?: string;
  avatarInitials: string;
  logout: () => void;
}

export function useKeycloakUser(): KeycloakUserInfo {
  const [userInfo, setUserInfo] = useState<KeycloakUserInfo>({
    username: "User",
    name: "User",
    avatarInitials: "U",
    logout: () => {
      if (typeof window !== "undefined") {
        window.location.href = "http://loeger-os/";
      }
    },
  });

  useEffect(() => {
    if (typeof window === "undefined") return;

    const updateFromKeycloak = () => {
      const keycloak = (window as any).__keycloak_instance__;
      if (keycloak && keycloak.tokenParsed) {
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
          username,
          name,
          email,
          avatarInitials: initials || "U",
          logout: () => {
            if (keycloak && typeof keycloak.logout === "function") {
              keycloak.logout({ redirectUri: "http://loeger-os/" });
            } else {
              window.location.href = "http://loeger-os/";
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
