"use client";

import { Badge, Button, useTranslation } from "@alfheim/shared";
import { CloudOff, RefreshCw, Check, Loader2 } from "lucide-react";
import type { SyncQueueState } from "../types";

interface SyncStatusBadgeProps extends SyncQueueState {
  onRetry: () => void;
}

/**
 * Compact sync indicator for the session HUD. Announces changes politely so a
 * screen-reader user learns a set was queued offline without losing focus.
 */
export function SyncStatusBadge({
  pendingCount,
  isSyncing,
  isOnline,
  lastError,
  onRetry,
}: SyncStatusBadgeProps) {
  const { t } = useTranslation();

  const content = () => {
    if (!isOnline) {
      return (
        <Badge variant="outline" className="gap-1.5">
          <CloudOff className="h-3 w-3" aria-hidden="true" />
          {pendingCount > 0 ? t("workout.pendingSets", { count: pendingCount }) : t("workout.offlineMode")}
        </Badge>
      );
    }

    if (isSyncing) {
      return (
        <Badge variant="secondary" className="gap-1.5">
          <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" />
          {t("workout.syncing")}
        </Badge>
      );
    }

    if (lastError) {
      return (
        <div className="flex items-center gap-2">
          <Badge variant="destructive">{t("workout.syncFailed")}</Badge>
          <Button variant="ghost" size="sm" className="min-h-11" onClick={onRetry}>
            <RefreshCw aria-hidden="true" />
            {t("workout.syncRetry")}
          </Button>
        </div>
      );
    }

    if (pendingCount > 0) {
      return <Badge variant="secondary">{t("workout.pendingSets", { count: pendingCount })}</Badge>;
    }

    return (
      <Badge variant="outline" className="gap-1.5">
        <Check className="h-3 w-3" aria-hidden="true" />
        {t("workout.synced")}
      </Badge>
    );
  };

  return (
    <div role="status" aria-live="polite" className="flex items-center">
      {content()}
    </div>
  );
}
