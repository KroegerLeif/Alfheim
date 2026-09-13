"use client";

import { useLayout, NavOption } from "./LayoutContext";
import { useTranslations } from "next-intl";
import { Sidebar as SharedSidebar } from "@alfheim/shared";
import {
  Laptop,
  Wrench,
  CalendarClock,
  History,
  ShoppingCart,
} from "lucide-react";

export function Sidebar() {
  const t = useTranslations("maintenance");
  const { activeNav, setActiveNav } = useLayout();

  const navItems = [
    { href: "devices", label: t("nav.deviceInventory"), icon: <Laptop className="h-4 w-4 shrink-0" /> },
    { href: "maintenance", label: t("nav.maintenanceWork"), icon: <Wrench className="h-4 w-4 shrink-0" /> },
    { href: "scheduled", label: t("nav.scheduledTasks"), icon: <CalendarClock className="h-4 w-4 shrink-0" /> },
    { href: "history", label: t("nav.serviceHistory"), icon: <History className="h-4 w-4 shrink-0" /> },
    { href: "shopping", label: t("nav.maintenanceShopping"), icon: <ShoppingCart className="h-4 w-4 shrink-0" /> },
  ];

  return (
    <SharedSidebar
      appName="maintenance"
      navItems={navItems}
      activeHref={activeNav}
      isCollapsible={true}
      collapsedWidth="w-20"
      expandedWidth="w-72"
      onNavClick={(href) => setActiveNav(href as NavOption)}
    />
  );
}
