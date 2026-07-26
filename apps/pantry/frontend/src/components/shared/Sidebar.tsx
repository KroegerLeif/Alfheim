"use client";

import { useTranslation } from "@loeger-os/shared";
import { Link, usePathname } from "@/navigation";
import { cn } from "@/lib/utils";
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
      icon: LayoutDashboard,
    },
    {
      href: "/inventory",
      label: t("pantry.stockInventory"),
      icon: Archive,
    },
    {
      href: "/products",
      label: t("pantry.productsTitle"),
      icon: Package,
    },
    {
      href: "/locations",
      label: t("pantry.locationsTitle"),
      icon: MapPin,
    },
    {
      href: "/analytics",
      label: t("pantry.analyticsTitle"),
      icon: BarChart3,
    },
    {
      href: "/ledger",
      label: t("pantry.ledgerTitle"),
      icon: History,
    },
  ];

  return (
    <aside className="w-64 border-r border-[var(--border-subtle)] bg-[var(--surface-card)] text-[var(--text-main)] flex flex-col h-full select-none font-mono">
      {/* Brand Header */}
      <div className="p-6 border-b border-[var(--border-subtle)] flex flex-col gap-1">
        <div className="font-heading text-2xl font-bold uppercase tracking-wide leading-none text-[var(--text-main)]">
          LOEGER // OS
        </div>
        <div className="text-[10px] text-[var(--text-muted)] uppercase tracking-widest font-mono">
          Pantry System v1.0
        </div>
      </div>

      {/* Navigation Menu */}
      <nav className="flex-1 p-4 space-y-2">
        {navItems.map((item) => {
          const isActive = pathname === item.href;
          const Icon = item.icon;

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 px-4 py-3.5 text-sm uppercase font-semibold transition-all border border-transparent cursor-pointer rounded-lg",
                isActive
                  ? "bg-[var(--primary-main)] text-black font-bold border-[var(--primary-main)] shadow-[0_0_12px_var(--accent-glow)]"
                  : "hover:bg-[var(--surface-elevated)] text-[var(--text-main)] hover:border-[var(--border-accent)]"
              )}
            >
              <Icon className="h-4 w-4 shrink-0" />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>

      {/* Alert Monitor Panel */}
      <div className="p-4 border-t border-[var(--border-subtle)] bg-[var(--surface-elevated)] flex flex-col gap-3">
        <div className="text-[10px] text-[var(--text-muted)] uppercase font-bold tracking-wider mb-1">
          {t("pantry.systemAlerts")}
        </div>

        {/* Low Stock Notification */}
        <div className={cn(
          "flex items-center justify-between px-3 py-2 border text-xs font-semibold uppercase transition-colors rounded",
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
          "flex items-center justify-between px-3 py-2 border text-xs font-semibold uppercase transition-colors rounded",
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
    </aside>
  );
}
