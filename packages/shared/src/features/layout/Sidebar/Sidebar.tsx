"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { AppLogo, cn, useTranslation } from "@alfheim/shared";
import React from "react";

export interface SidebarNavItem {
  href: string;
  label: string;
  icon: React.ReactNode;
}

export interface SidebarProps {
  appName: string;
  navItems: SidebarNavItem[];
  activeHref: string;
  isCollapsible?: boolean;
  collapsedWidth?: string;
  expandedWidth?: string;
  storageKey?: string;
  bottomContent?: React.ReactNode;
  className?: string;
  onNavClick?: (href: string) => void;
}

/**
 * Consolidated navigation sidebar component supporting collapse/expand,
 * flexible navigation items, and optional bottom content areas.
 * Based on the workout app reference implementation.
 */
export function Sidebar({
  appName,
  navItems,
  activeHref,
  isCollapsible = true,
  collapsedWidth = "w-20",
  expandedWidth = "w-64",
  storageKey,
  bottomContent,
  className = "",
  onNavClick,
}: SidebarProps) {
  const { t } = useTranslation();
  const defaultStorageKey = `alfheim_${appName}_sidebar_collapsed`;
  const key = storageKey || defaultStorageKey;
  const [isCollapsed, setIsCollapsed] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem(key);
    if (saved !== null) {
      setIsCollapsed(saved === "true");
    }
  }, [key]);

  const toggleCollapse = () => {
    setIsCollapsed((prev) => {
      const next = !prev;
      localStorage.setItem(key, String(next));
      return next;
    });
  };

  return (
    <aside
      className={cn(
        "hidden md:flex h-full shrink-0 flex-col select-none font-sans transition-all duration-300 ease-in-out",
        "border-r border-[var(--border-subtle)] bg-[var(--surface-card)] text-[var(--text-main)]",
        isCollapsed ? collapsedWidth : expandedWidth,
        className
      )}
    >
      {/* Header */}
      <div className="flex h-16 items-center gap-3 border-b border-[var(--border-subtle)] px-4">
        <AppLogo appName={appName as any} size={32} />
        {!isCollapsed && (
          <span className="truncate font-heading text-sm font-bold uppercase tracking-wide">
            {t(`${appName}.title`) || appName.toUpperCase()}
          </span>
        )}
      </div>

      {/* Navigation */}
      <nav aria-label={appName} className="flex-1 space-y-1 overflow-y-auto p-3">
        {navItems.map((item) => {
          const isActive = item.href === activeHref;
          const isButton = onNavClick !== undefined;

          if (isButton) {
            return (
              <button
                key={item.href}
                type="button"
                onClick={() => onNavClick(item.href)}
                aria-current={isActive ? "page" : undefined}
                title={isCollapsed ? item.label : undefined}
                className={cn(
                  "w-full flex min-h-11 items-center gap-3 rounded-lg px-3 font-mono text-xs font-bold uppercase tracking-wider transition-colors",
                  isCollapsed && "justify-center",
                  isActive
                    ? "bg-[var(--primary-main)] text-black"
                    : "text-[var(--text-muted)] hover:bg-[var(--surface-elevated)] hover:text-[var(--text-main)]"
                )}
              >
                <span aria-hidden="true">{item.icon}</span>
                {!isCollapsed && <span className="truncate">{item.label}</span>}
              </button>
            );
          }

          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={isActive ? "page" : undefined}
              title={isCollapsed ? item.label : undefined}
              className={cn(
                "flex min-h-11 items-center gap-3 rounded-lg px-3 font-mono text-xs font-bold uppercase tracking-wider transition-colors",
                isCollapsed && "justify-center",
                isActive
                  ? "bg-[var(--primary-main)] text-black"
                  : "text-[var(--text-muted)] hover:bg-[var(--surface-elevated)] hover:text-[var(--text-main)]"
              )}
            >
              <span aria-hidden="true">{item.icon}</span>
              {!isCollapsed && <span className="truncate">{item.label}</span>}
            </Link>
          );
        })}
      </nav>

      {/* Bottom Content (optional) */}
      {bottomContent && !isCollapsed && (
        <div className="border-t border-[var(--border-subtle)] p-3">
          {bottomContent}
        </div>
      )}

      {/* Collapse Toggle Button */}
      {isCollapsible && (
        <button
          type="button"
          onClick={toggleCollapse}
          aria-expanded={!isCollapsed}
          aria-label={t(isCollapsed ? "common.expand_sidebar" : "common.collapse_sidebar")}
          className="flex min-h-11 cursor-pointer items-center justify-center border-t border-[var(--border-subtle)] text-[var(--text-muted)] transition-colors hover:text-[var(--text-main)]"
        >
          {isCollapsed ? (
            <ChevronRight className="h-4 w-4" aria-hidden="true" />
          ) : (
            <ChevronLeft className="h-4 w-4" aria-hidden="true" />
          )}
        </button>
      )}
    </aside>
  );
}
