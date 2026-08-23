"use client";

import { useTranslations } from "next-intl";
import { ShoppingCart } from "lucide-react";
import { ApiError } from "@/lib/api";

interface ShoppingErrorBannerProps {
  listsErrObj: unknown;
  refetchLists: () => void;
}

export function ShoppingErrorBanner({ listsErrObj, refetchLists }: ShoppingErrorBannerProps) {
  const errT = useTranslations("Error");

  const isAuthError =
    (listsErrObj as ApiError | null)?.status === 401 ||
    (listsErrObj as ApiError | null)?.status === 403 ||
    (listsErrObj instanceof Error && listsErrObj.message.includes("401"));

  const handleLogin = () => {
    if (typeof window !== "undefined") {
      const keycloak = (window as Window & { __keycloak_instance__?: { login: () => void } }).__keycloak_instance__;
      if (keycloak && typeof keycloak.login === "function") {
        keycloak.login();
        return;
      }
      window.location.reload();
    }
  };

  return (
    <div className="flex-1 flex flex-col items-center justify-center p-8 gap-4 text-center">
      <div className="glass-card max-w-md p-6 rounded-2xl border border-red-500/20 space-y-4">
        <div className="h-12 w-12 rounded-xl bg-red-500/10 text-red-400 flex items-center justify-center mx-auto">
          <ShoppingCart className="h-6 w-6" />
        </div>
        <h2 className="text-lg font-bold text-foreground uppercase tracking-wide">
          {isAuthError ? errT("sessionExpired") : errT("fetchFailed")}
        </h2>
        <p className="text-xs text-muted-foreground">
          {isAuthError
            ? errT("sessionExpiredDesc")
            : listsErrObj instanceof Error
            ? listsErrObj.message
            : errT("fetchFailedDesc")}
        </p>
        <div className="flex gap-2 justify-center">
          {isAuthError ? (
            <button
              onClick={handleLogin}
              className="px-4 py-2 rounded-xl bg-primary text-primary-foreground font-heading text-xs font-extrabold uppercase tracking-wider transition-colors cursor-pointer"
            >
              {errT("logIn")}
            </button>
          ) : (
            <button
              onClick={() => refetchLists()}
              className="px-4 py-2 rounded-xl bg-primary text-primary-foreground font-heading text-xs font-extrabold uppercase tracking-wider transition-colors cursor-pointer"
            >
              {errT("retry")}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
