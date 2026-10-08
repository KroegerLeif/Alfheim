"use client";

import { Badge, Button, useTranslation } from "@alfheim/shared";
import { CloudOff, RefreshCw, Check, Loader2, TriangleAlert, X } from "lucide-react";
import type { SyncQueueState } from "../types";

interface SyncStatusBadgeProps extends SyncQueueState {
  onRetry: () => void;
  /** Hides the dropped-sets warning once the user has read it. */
  onDismissDropped?: () => void;
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
  droppedKeys,
  onRetry,
  onDismissDropped,
}: SyncStatusBadgeProps) {
  const { t } = useTranslation();
  const droppedCount = (droppedKeys ?? []).length;

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
    <div className="flex min-w-0 flex-col items-end gap-2">
      <div role="status" aria-live="polite" className="flex max-w-full items-center">
        {content()}
      </div>

      {droppedCount > 0 && (
        <div
          role="alert"
          className="flex max-w-full items-start gap-2 rounded-lg border border-red-800/40 bg-red-950/20 px-3 py-2 text-xs font-bold text-red-400"
        >
          <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <span className="min-w-0 break-words">{t("workout.setsDropped", { count: droppedCount })}</span>
          {onDismissDropped && (
            <Button
              variant="ghost"
              size="icon"
              className="h-6 min-h-6 w-6 shrink-0 text-red-400"
              aria-label={t("workout.dismiss")}
              onClick={onDismissDropped}
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
