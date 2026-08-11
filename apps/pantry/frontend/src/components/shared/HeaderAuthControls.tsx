"use client";

import { AuthControls } from "@alfheim/shared";
import { useAuth } from "@/core/authContext";

export function HeaderAuthControls() {
  const { user, logout } = useAuth();
  return <AuthControls user={user} onLogout={logout} />;
}
