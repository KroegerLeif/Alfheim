"use client";

import { useTranslation } from "@alfheim/shared";
import { Badge } from "@alfheim/shared";
import { InventoryStateReadWithRelations } from "@/features/inventory/types";

type AlertItem = InventoryStateReadWithRelations & { severity: "high" | "medium" };

interface AlertsFeedProps {
  isLoading: boolean;
  alertFeed: AlertItem[];
}

/**
 * AlertsFeed
 * Renders the urgent expiration log feed sorted by severity (expired > expiring soon).
 */
export function AlertsFeed({ isLoading, alertFeed }: AlertsFeedProps) {
  const { t } = useTranslation();

  return (
    <div className="lg:col-span-2 border border-[var(--border-subtle)] bg-[var(--surface-card)] p-6 flex flex-col min-h-[400px] rounded-lg shadow-sm">
      <h2 className="font-heading text-2xl font-black border-b border-[var(--border-subtle)] pb-3 mb-4 uppercase tracking-wide text-[var(--text-main)]">
        {t("pantry.criticalLogs")}
      </h2>
      {isLoading ? (
        <div className="flex-1 flex items-center justify-center text-xs text-[var(--text-muted)]">{t("pantry.retrievingAlerts")}</div>
      ) : alertFeed.length === 0 ? (
        <div className="flex-1 flex items-center justify-center text-xs text-[var(--text-muted)]">{t("pantry.noAlerts")}</div>
      ) : (
        <div className="flex-1 overflow-y-auto space-y-3 max-h-[350px] pr-1">
          {alertFeed.map((alert) => (
            <div key={alert.id}
              className={`border p-4 flex items-center justify-between rounded ${alert.severity === "high" ? "border-red-800/40 bg-red-950/20 text-red-400" : "border-amber-800/40 bg-amber-950/20 text-amber-400"}`}>
              <div>
                <div className="font-black uppercase text-sm tracking-tight">{alert.product?.name}</div>
                <div className="text-[10px] text-[var(--text-muted)] mt-0.5 uppercase">
                  {t("pantry.location")}: {alert.location?.name} | {t("pantry.batch")}: {alert.batch_code ?? "NONE"}
                </div>
              </div>
              <div className="flex items-center gap-4">
                <div className="text-right">
                  <div className="font-bold text-xs uppercase">{t("pantry.expiring")}</div>
                  <div className="text-[10px] font-bold mt-0.5">{alert.expiration_date}</div>
                </div>
                <Badge variant={alert.severity === "high" ? "destructive" : "outline"} className="text-[9px]">
                  {alert.severity === "high" ? t("pantry.expired") : t("pantry.soon")}
                </Badge>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
