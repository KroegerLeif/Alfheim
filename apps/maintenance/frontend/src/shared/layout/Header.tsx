"use client";

import React from "react";
import { AppHeader, useAuth, resolveFrontendUrl } from "@alfheim/shared";
import { useTranslations } from "next-intl";
import { useLayout, NavOption } from "./LayoutContext";
import { NotificationMenu } from "./NotificationMenu";

/**
 * Maintenance Header utilizing the canonical @alfheim/shared AppHeader layout.
 */
export function Header() {
  const t = useTranslations("maintenance");
  const { activeNav } = useLayout();
  const { user, logout } = useAuth();

  const titleMap: Record<NavOption, string> = {
    devices: t("nav.deviceInventory"),
    maintenance: t("nav.maintenanceWork"),
    scheduled: t("nav.scheduledTasks"),
    history: t("nav.serviceHistory"),
    shopping: t("nav.maintenanceShopping"),
  };

  return (
    <AppHeader
      appName="maintenance"
      brandTitle="ALFHEIM // MAINTENANCE"
      brandSubtitle={titleMap[activeNav]}
      showBackToDashboard={true}
      backToDashboardHref={resolveFrontendUrl()}
      user={user}
      onLogout={logout}
      notificationSlot={<NotificationMenu />}
    />
  );
}
