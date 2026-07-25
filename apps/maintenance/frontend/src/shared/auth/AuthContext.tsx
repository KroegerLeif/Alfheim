"use client";

import React, { createContext, useContext } from "react";

export interface UserProfile {
  name: string;
  username: string;
  email?: string;
  role: string;
  initials: string;
}

interface AuthContextType {
  user: UserProfile | null;
  token: string | null;
  logout: () => void;
}

export const AuthContext = createContext<AuthContextType>({
  user: null,
  token: null,
  logout: () => {},
});

export const useAuth = () => useContext(AuthContext);
