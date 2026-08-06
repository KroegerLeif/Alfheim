"use client";

import React, { createContext, useContext } from "react";
import { UserIdentity } from "@loeger-os/shared";

export interface AuthContextType {
  user: UserIdentity | null;
  token: string | null;
  logout: () => void;
}

export const AuthContext = createContext<AuthContextType>({
  user: null,
  token: null,
  logout: () => {},
});

export const useAuth = () => useContext(AuthContext);
