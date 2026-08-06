"use client";

import { AuthControls } from "@loeger-os/shared";
import { useAuth } from "@/core/authContext";

export function HeaderAuthControls() {
  const { user, logout } = useAuth();
  return <AuthControls user={user} onLogout={logout} />;
}
