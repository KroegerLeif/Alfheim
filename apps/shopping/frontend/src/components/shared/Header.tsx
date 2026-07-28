"use client";

import { useTranslations, useLocale } from "next-intl";
import { ArrowLeft, Menu, ShoppingBag } from "lucide-react";
import { usePathname, useRouter } from "@/navigation";
import { ThemeToggle } from "./ThemeToggle";
import { useSidebar } from "@/app/[locale]/providers";

/**
 * Sticky top application bar consolidating system chrome:
 * - Left: Back to Dashboard link, sidebar toggle, brand title.
 * - Right: Language Selector (DE/EN) and 2-way Light/Dark theme switch.
 */
export function Header() {
  const tNav = useTranslations("Navigation");
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();
  const { isSidebarOpen, setIsSidebarOpen } = useSidebar();

  const handleLanguageChange = (newLocale: "de" | "en") => {
    if (newLocale === locale) return;
    router.replace(pathname, { locale: newLocale });
  };

  return (
    <header className="h-14 border-b border-border/40 bg-card/80 backdrop-blur-md px-4 md:px-6 flex items-center justify-between shrink-0 select-none z-30 transition-colors duration-200">
      {/* Left side: Back to Dashboard & Sidebar Toggle & Title */}
      <div className="flex items-center gap-3">
        <a
          href="http://loeger-os/"
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg glass-inset hover:glass-active text-xs font-mono font-semibold text-muted-foreground hover:text-foreground transition-all duration-200"
          title={tNav("backToDashboard")}
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          <span className="hidden sm:inline font-bold">loeger-os</span>
        </a>

        {!isSidebarOpen && (
          <button
            onClick={() => setIsSidebarOpen(true)}
            className="p-1.5 rounded-lg glass-inset hover:glass-active text-muted-foreground hover:text-foreground cursor-pointer transition-colors"
            aria-label="Expand Sidebar"
            title="Expand Sidebar"
          >
            <Menu className="h-4 w-4" />
          </button>
        )}

        <div className="flex items-center gap-2 border-l border-border/40 pl-3">
          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center text-white shadow-sm shadow-blue-500/20">
            <ShoppingBag className="h-4 w-4" />
          </div>
          <div className="flex flex-col leading-none">
            <span className="font-heading text-sm font-extrabold uppercase tracking-wide text-foreground">
              Shopping
            </span>
            <span className="text-[9px] font-mono text-muted-foreground/60 uppercase tracking-widest hidden md:inline">
              {tNav("subtitle")}
            </span>
          </div>
        </div>
      </div>

      {/* Right side: i18n Language Toggle & 2-Way Light/Dark Switch */}
      <div className="flex items-center gap-2.5">
        {/* Language Switcher (DE / EN) */}
        <div className="flex items-center p-0.5 rounded-lg glass-inset font-mono text-[11px] font-bold">
          <button
            onClick={() => handleLanguageChange("de")}
            className={`px-2 py-1 rounded-md transition-all cursor-pointer ${
              locale === "de"
                ? "bg-primary text-primary-foreground font-black shadow-xs"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            DE
          </button>
          <button
            onClick={() => handleLanguageChange("en")}
            className={`px-2 py-1 rounded-md transition-all cursor-pointer ${
              locale === "en"
                ? "bg-primary text-primary-foreground font-black shadow-xs"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            EN
          </button>
        </div>

        {/* 2-Way Light / Dark Theme Switch */}
        <ThemeToggle />
      </div>
    </header>
  );
}
