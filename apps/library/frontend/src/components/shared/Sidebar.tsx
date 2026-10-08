"use client";

import { usePathname } from "next/navigation";
import { BookOpen, Handshake, MapPin, Tv } from "lucide-react";
import { useTranslation, Sidebar as SharedSidebar } from "@alfheim/shared";

const ICON_CLASS = "h-4 w-4 shrink-0";

export function Sidebar() {
  const pathname = usePathname();
  const { t } = useTranslation();

  const navigationItems = [
    { name: t("library.nav.catalog"), href: "/catalog", icon: <BookOpen className={ICON_CLASS} /> },
    { name: t("library.nav.locations"), href: "/locations", icon: <MapPin className={ICON_CLASS} /> },
    { name: t("library.nav.lending"), href: "/lending", icon: <Handshake className={ICON_CLASS} /> },
    { name: t("library.nav.providers"), href: "/providers", icon: <Tv className={ICON_CLASS} /> },
  ];

  return (
    <SharedSidebar
      appName="library"
      navItems={navigationItems.map((item) => ({
        href: item.href,
        label: item.name,
        icon: item.icon,
      }))}
      activeHref={navigationItems.find((item) => pathname.includes(item.href))?.href || "/catalog"}
      isCollapsible={false}
      expandedWidth="w-64"
    />
  );
}
