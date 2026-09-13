"use client";

import { usePathname } from "next/navigation";
import { useTranslation, Sidebar as SharedSidebar } from "@alfheim/shared";

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
    <SharedSidebar
      appName="library"
      navItems={navigationItems.map((item) => ({
        href: item.href,
        label: item.name,
        icon: <span className="material-symbols-outlined text-sm">{item.icon}</span>,
      }))}
      activeHref={navigationItems.find((item) => pathname.includes(item.href))?.href || "/catalog"}
      isCollapsible={false}
      expandedWidth="w-64"
    />
  );
}
