"use client";

import { useTranslations } from "next-intl";
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
 * Utilizes Next-Intl routing, displays warning counts for low-stock and expired products,
 * and maintains touch-optimized elements for local industrial screen deployment.
 */
export function Sidebar() {
  const t = useTranslations("Navigation");
  const pathname = usePathname();

  // Retrieve reactive alert states directly from cache-integrated TanStack Query hooks
  const { data: lowStockItems = [] } = useLowStockItems();
  const { data: expirationSummary } = useExpirationSummary();

  const lowStockCount = lowStockItems.length;
  const expiredCount = expirationSummary?.expired?.length || 0;

  const navItems = [
    {
      href: "/",
      label: t("dashboard"),
      icon: LayoutDashboard,
    },
    {
      href: "/inventory",
      label: t("inventory"),
      icon: Archive,
    },
    {
      href: "/products",
      label: t("products"),
      icon: Package,
    },
    {
      href: "/locations",
      label: t("locations"),
      icon: MapPin,
    },
    {
      href: "/analytics",
      label: t("analytics"),
      icon: BarChart3,
    },
    {
      href: "/ledger",
      label: t("ledger"),
      icon: History,
    },
  ];


  return (
    <aside className="w-64 border-r border-border bg-background flex flex-col h-full select-none font-mono">
      {/* Brand Header */}
      <div className="p-6 border-b border-border flex flex-col gap-1">
        <div className="font-heading text-2xl font-bold uppercase tracking-wide leading-none">
          LOEGER // OS
        </div>
        <div className="text-[10px] text-muted-foreground uppercase tracking-widest">
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
                "flex items-center gap-3 px-4 py-3.5 text-sm uppercase font-semibold transition-all border border-transparent cursor-pointer",
                isActive
                  ? "bg-primary text-primary-foreground border-primary"
                  : "hover:bg-neutral-100 hover:border-neutral-200 text-foreground"
              )}
            >
              <Icon className="h-4 w-4 shrink-0" />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>

      {/* Alert Monitor Panel */}
      <div className="p-4 border-t border-border bg-neutral-50 flex flex-col gap-3">
        <div className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider mb-1">
          System Alerts
        </div>

        {/* Low Stock Notification */}
        <div className={cn(
          "flex items-center justify-between px-3 py-2 border text-xs font-semibold uppercase transition-colors",
          lowStockCount > 0 
            ? "border-amber-600 bg-amber-50 text-amber-900" 
            : "border-neutral-200 text-neutral-400 bg-neutral-100"
        )}>
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-3.5 w-3.5" />
            <span>{t("lowStock")}</span>
          </div>
          <span className="font-bold font-mono">{lowStockCount}</span>
        </div>

        {/* Expired Items Notification */}
        <div className={cn(
          "flex items-center justify-between px-3 py-2 border text-xs font-semibold uppercase transition-colors",
          expiredCount > 0 
            ? "border-destructive bg-red-50 text-destructive" 
            : "border-neutral-200 text-neutral-400 bg-neutral-100"
        )}>
          <div className="flex items-center gap-2">
            <Clock className="h-3.5 w-3.5" />
            <span>{t("expired")}</span>
          </div>
          <span className="font-bold font-mono">{expiredCount}</span>
        </div>
      </div>
    </aside>
  );
}
