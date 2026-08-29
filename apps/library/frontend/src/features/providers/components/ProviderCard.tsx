import React from "react";
import { Badge, Button, useTranslation } from "@alfheim/shared";
import { ProviderSubscription, ProviderType } from "../types";

interface ProviderCardProps {
  provider: ProviderSubscription;
  onToggleActive: (id: string, currentStatus: boolean) => void;
  onDelete: (id: string) => void;
}

export function ProviderCard({
  provider,
  onToggleActive,
  onDelete,
}: ProviderCardProps) {
  const { t } = useTranslation();

  const getTypeLabel = (type: ProviderType) => {
    switch (type) {
      case "MOVIE":
        return t("library.providers.typeMovie");
      case "GAME":
        return t("library.providers.typeGame");
      case "BOTH":
        return t("library.providers.typeBoth");
      default:
        return type;
    }
  };

  return (
    <div className="rounded-xl border border-[var(--border-main,#334155)] bg-[var(--surface-card,#1e293b)] p-4 shadow-sm flex flex-col justify-between gap-4 transition-colors hover:border-primary/50">
      <div className="space-y-2">
        <div className="flex items-start justify-between gap-2">
          <h3 className="font-semibold text-[var(--text-main,#f8fafc)] text-base">
            {provider.name}
          </h3>
          <Badge
            variant={provider.is_active ? "default" : "secondary"}
            className={
              provider.is_active
                ? "bg-emerald-600/20 text-emerald-400 border-emerald-500/30"
                : "bg-slate-700/50 text-slate-400 border-slate-600/30"
            }
          >
            {provider.is_active
              ? t("library.providers.statusActive")
              : t("library.providers.statusInactive")}
          </Badge>
        </div>

        <div className="flex items-center gap-2">
          <Badge variant="outline" className="text-xs">
            {getTypeLabel(provider.provider_type)}
          </Badge>
        </div>

        {provider.notes && (
          <p className="text-xs text-[var(--text-muted,#94a3b8)] line-clamp-2">
            {provider.notes}
          </p>
        )}
      </div>

      <div className="flex items-center justify-between gap-2 pt-2 border-t border-[var(--border-subtle,#334155)]">
        <Button
          type="button"
          variant={provider.is_active ? "outline" : "default"}
          size="sm"
          onClick={() => onToggleActive(provider.id, provider.is_active)}
          className="text-xs"
        >
          {provider.is_active
            ? t("library.providers.deactivate")
            : t("library.providers.activate")}
        </Button>

        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => onDelete(provider.id)}
          className="text-xs text-red-400 hover:text-red-300 hover:bg-red-500/10"
        >
          {t("library.providers.delete")}
        </Button>
      </div>
    </div>
  );
}
