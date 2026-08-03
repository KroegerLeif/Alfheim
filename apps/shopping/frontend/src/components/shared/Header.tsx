"use client";

import { useTranslations } from "next-intl";
import { Menu, ShoppingBag } from "lucide-react";
import {
  BackToDashboard,
  ThemeToggle,
  AuthControls,
} from "@loeger-os/shared";
import { LanguageSwitcher } from "@/components/shared/LanguageSwitcher";
import { useSidebar } from "@/app/[locale]/providers";
import { useKeycloakUser } from "@/lib/useKeycloakUser";

/**
 * Sticky top application bar consolidating system chrome:
 * - Left: [Hamburger Menu Toggle] -> [App Logo / Shopping Name] -> [<- Back to Dashboard]
 * - Right: Switcher, Language Selector, Theme Toggle & Auth controls.
 */
export function Header() {
  const tNav = useTranslations("Navigation");
  const { isSidebarOpen, setIsSidebarOpen } = useSidebar();
  const user = useKeycloakUser();

  const authUser = user ? {
    name: user.name,
    preferred_username: user.username,
    email: user.email,
  } : null;

  return (
    <header className="h-16 border-b border-[var(--border-subtle)] bg-[var(--surface-card)]/85 px-4 md:px-6 flex items-center justify-between shrink-0 select-none z-30">
      {/* Left side: [Hamburger Menu Toggle] -> [App Logo / Shopping Name] -> [<- Back to Dashboard] */}
      <div className="flex items-center gap-3">
        {!isSidebarOpen && (
          <button
            onClick={() => setIsSidebarOpen(true)}
            className="p-1.5 rounded-lg glass-inset hover:glass-active text-muted-foreground hover:text-foreground cursor-pointer transition-colors"
            aria-label={tNav("expandSidebar")}
            title={tNav("expandSidebar")}
          >
            <Menu className="h-4 w-4" />
          </button>
        )}

        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-[var(--primary-main)] flex items-center justify-center text-white shadow-sm shadow-blue-500/20">
            <ShoppingBag className="h-4 w-4" />
          </div>
          <div className="flex flex-col leading-none">
            <span className="font-heading text-sm font-extrabold uppercase tracking-wide text-[var(--text-main)]">
              {tNav("title")}
            </span>
            <span className="text-[9px] font-mono text-[var(--text-muted)] uppercase tracking-widest hidden md:inline">
              {tNav("subtitle")}
            </span>
          </div>
        </div>

        <div className="border-l border-[var(--border-subtle)] pl-3">
          <BackToDashboard href="http://loeger-os/" />
        </div>
      </div>

      {/* Right side: Switcher, Language Selector, Theme Toggle & Auth controls */}
      <div className="flex items-center gap-3">
        <LanguageSwitcher />
        <ThemeToggle showVariantToggle={true} />
        <AuthControls user={authUser} onLogout={user.logout} />
      </div>
    </header>
  );
}
