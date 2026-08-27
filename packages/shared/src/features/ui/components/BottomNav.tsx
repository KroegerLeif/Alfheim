"use client";

import * as React from "react";
import { cn } from "../utils/cn";

export interface BottomNavItem {
  /** Stable key and href target. */
  href: string;
  /** Already-translated label — this component does no translation itself. */
  label: string;
  icon: React.ReactNode;
  /** Optional count rendered as a badge on the icon. */
  badgeCount?: number;
}

export interface BottomNavProps extends React.HTMLAttributes<HTMLElement> {
  items: BottomNavItem[];
  /** href of the currently active item; compare against `item.href`. */
  activeHref?: string;
  /**
   * Link renderer. Defaults to a plain `<a>`; pass the app's locale-aware
   * `Link` so client-side navigation and locale prefixes are preserved.
   */
  renderLink?: (item: BottomNavItem, props: BottomNavLinkProps) => React.ReactNode;
  /** Accessible name for the nav landmark. */
  ariaLabel: string;
}

export interface BottomNavLinkProps {
  className: string;
  "aria-current": "page" | undefined;
  children: React.ReactNode;
}

/**
 * Fixed mobile tab bar. Renders nothing above the `md` breakpoint by default,
 * so pair it with a sidebar for wider viewports and reserve space for it on the
 * scroll container (e.g. `pb-20 md:pb-6`).
 *
 * Every target is at least 44px tall to satisfy the minimum touch-target size.
 */
function BottomNav({
  items,
  activeHref,
  renderLink,
  ariaLabel,
  className,
  ...props
}: BottomNavProps) {
  const safeItems = items ?? [];

  return (
    <nav
      aria-label={ariaLabel}
      className={cn(
        "md:hidden fixed bottom-0 inset-x-0 z-30 h-16",
        "border-t border-[var(--border-subtle)] bg-[var(--surface-card)]",
        "flex items-stretch justify-around",
        className
      )}
      {...props}
    >
      {safeItems.map((item) => {
        const isActive = item.href === activeHref;
        const linkProps: BottomNavLinkProps = {
          className: cn(
            "flex flex-1 flex-col items-center justify-center gap-1 min-h-11 px-2",
            "font-mono text-[10px] font-bold uppercase tracking-wider transition-colors",
            isActive
              ? "text-[var(--primary-main)]"
              : "text-[var(--text-muted)] hover:text-[var(--text-main)]"
          ),
          "aria-current": isActive ? "page" : undefined,
          children: (
            <>
              <span className="relative" aria-hidden="true">
                {item.icon}
                {item.badgeCount !== undefined && item.badgeCount > 0 && (
                  <span className="absolute -right-2 -top-1 min-w-4 rounded-full bg-[var(--primary-main)] px-1 text-[9px] leading-4 text-black">
                    {item.badgeCount}
                  </span>
                )}
              </span>
              <span>{item.label}</span>
            </>
          ),
        };

        if (renderLink) {
          return (
            <React.Fragment key={item.href}>{renderLink(item, linkProps)}</React.Fragment>
          );
        }

        return (
          <a key={item.href} href={item.href} {...linkProps} />
        );
      })}
    </nav>
  );
}

export { BottomNav };
