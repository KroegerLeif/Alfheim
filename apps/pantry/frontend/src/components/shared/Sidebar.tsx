"use client";

import { usePathname } from "@/navigation";
import { useTranslation, Sidebar as SharedSidebar, cn } from "@alfheim/shared";
import {
  LayoutDashboard,
  Archive,
  History,
  AlertTriangle,
  Clock,
  Package,
  MapPin,
  BarChart3
} from "lucide-react";
import { useLowStockItems, useExpirationSummary } from "@/features/inventory/services/inventoryService";

/**
 * Sidebar navigation component for the Digital Pantry application.
 * Utilizes design system theme tokens, displays reactive warning counts for low-stock and expired products.
 */
export function Sidebar() {
  const { t } = useTranslation();
  const pathname = usePathname();

  // Retrieve reactive alert states directly from cache-integrated TanStack Query hooks
  const { data: lowStockItems = [] } = useLowStockItems();
  const { data: expirationSummary } = useExpirationSummary();

  const lowStockCount = lowStockItems.length;
  const expiredCount = expirationSummary?.expired?.length || 0;

  const navItems = [
    {
      href: "/",
      label: t("nav.dashboard"),
      icon: <LayoutDashboard className="h-4 w-4 shrink-0" />,
    },
    {
      href: "/inventory",
      label: t("pantry.stockInventory"),
      icon: <Archive className="h-4 w-4 shrink-0" />,
    },
    {
      href: "/products",
      label: t("pantry.productsTitle"),
      icon: <Package className="h-4 w-4 shrink-0" />,
    },
    {
      href: "/locations",
      label: t("pantry.locationsTitle"),
      icon: <MapPin className="h-4 w-4 shrink-0" />,
    },
    {
      href: "/analytics",
      label: t("pantry.analyticsTitle"),
      icon: <BarChart3 className="h-4 w-4 shrink-0" />,
    },
    {
      href: "/ledger",
      label: t("pantry.ledgerTitle"),
      icon: <History className="h-4 w-4 shrink-0" />,
    },
  ];

  return (
    <SharedSidebar
      appName="pantry"
      navItems={navItems}
      activeHref={pathname}
      isCollapsible={false}
      expandedWidth="w-64"
      bottomContent={
        <div className="flex flex-col gap-2.5">
          <div className="text-[10px] text-[var(--text-muted)] uppercase font-bold tracking-wider font-mono">
            {t("pantry.systemAlerts")}
          </div>

          {/* Low Stock Notification */}
          <div className={cn(
            "flex items-center justify-between px-3 py-2 border text-xs font-semibold uppercase transition-colors rounded-lg",
            lowStockCount > 0
              ? "border-amber-800/40 bg-amber-950/20 text-amber-400"
              : "border-[var(--border-subtle)] text-[var(--text-muted)] bg-[var(--surface-card)]"
          )}>
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-3.5 w-3.5" />
              <span>{t("pantry.lowStock")}</span>
            </div>
            <span className="font-bold font-mono">{lowStockCount}</span>
          </div>

          {/* Expired Items Notification */}
          <div className={cn(
            "flex items-center justify-between px-3 py-2 border text-xs font-semibold uppercase transition-colors rounded-lg",
            expiredCount > 0
              ? "border-red-800/40 bg-red-950/20 text-red-400"
              : "border-[var(--border-subtle)] text-[var(--text-muted)] bg-[var(--surface-card)]"
          )}>
            <div className="flex items-center gap-2">
              <Clock className="h-3.5 w-3.5" />
              <span>{t("pantry.expired")}</span>
            </div>
            <span className="font-bold font-mono">{expiredCount}</span>
          </div>
        </div>
      }
    />
  );
}
