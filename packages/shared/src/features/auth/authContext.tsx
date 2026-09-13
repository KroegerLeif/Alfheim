"use client";

import { createContext, useContext } from "react";
import { UserIdentity } from "@alfheim/shared";

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
