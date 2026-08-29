"use client";

import { BottomNav, useTranslation } from "@alfheim/shared";
import { Link } from "@/navigation";
import { useActiveNavHref, useWorkoutNavItems } from "./navItems";

/**
 * Mobile tab bar. The shared BottomNav is `md:hidden`, so this renders only
 * below the md breakpoint where the Sidebar is hidden.
 */
export function WorkoutBottomNav() {
  const { t } = useTranslation();
  const items = useWorkoutNavItems();
  const activeHref = useActiveNavHref(items);

  return (
    <BottomNav
      ariaLabel={t("workout.title")}
      items={items}
      activeHref={activeHref}
      renderLink={(item, props) => (
        <Link href={item.href} className={props.className} aria-current={props["aria-current"]}>
          {props.children}
        </Link>
      )}
    />
  );
}
