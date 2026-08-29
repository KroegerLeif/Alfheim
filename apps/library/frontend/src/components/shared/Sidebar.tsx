"use client";

import { usePathname } from "next/navigation";
import { Link } from "@/navigation";
import { useTranslation } from "@alfheim/shared";

export function Sidebar() {
  const pathname = usePathname();
  const { t } = useTranslation();

  const navigationItems = [
    { name: t("library.nav.catalog"), href: "/catalog", icon: "menu_book" },
    { name: t("library.nav.locations"), href: "/locations", icon: "folder" },
    { name: t("library.nav.lending"), href: "/lending", icon: "handshake" },
    { name: t("library.nav.providers"), href: "/providers", icon: "connected_tv" },
  ];

  return (
    <aside className="w-64 bg-[var(--surface-subtle)] border-r border-[var(--border-subtle)] flex flex-col p-4 gap-2">
      <div className="px-3 py-2 text-xl font-bold text-[var(--primary-main)] flex items-center gap-2">
        <span className="material-symbols-outlined">local_library</span>
        <span>{t("library.nav.title")}</span>
      </div>
      <nav className="flex flex-col gap-1 mt-4">
        {navigationItems.map((item) => {
          const isActive = pathname.includes(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors ${
                isActive
                  ? "bg-[var(--primary-main)] text-black"
                  : "text-[var(--text-muted)] hover:bg-[var(--surface-hover)] hover:text-[var(--text-main)]"
              }`}
            >
              <span className="material-symbols-outlined text-lg">{item.icon}</span>
              <span>{item.name}</span>
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
