import React from "react";
import { Button, useTranslation } from "@alfheim/shared";
import type { LocationNode } from "../types";
import { LocationTreeNodeItem } from "./LocationTreeNodeItem";

interface LocationTreeViewProps {
  locations: LocationNode[];
  isLoading: boolean;
  onAddRootLocation: () => void;
  onAddChildLocation: (parentId: string) => void;
  onEditLocation: (node: LocationNode) => void;
  onDeleteLocation: (node: LocationNode) => void;
}

export function LocationTreeView({
  locations,
  isLoading,
  onAddRootLocation,
  onAddChildLocation,
  onEditLocation,
  onDeleteLocation,
}: LocationTreeViewProps) {
  const { t } = useTranslation();

  if (isLoading) {
    return (
      <div className="rounded-2xl border border-[var(--border-subtle,#334155)] bg-[var(--surface-card,#1e293b)] p-6 space-y-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="h-12 w-full rounded-xl bg-[var(--surface-muted,#0f172a)] animate-pulse"
          />
        ))}
      </div>
    );
  }

  if (locations.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-[var(--border-main,#334155)] bg-[var(--surface-card,#1e293b)] flex flex-col items-center justify-center p-12 text-center">
        <div className="h-12 w-12 rounded-full bg-[var(--surface-card,#1e293b)] flex items-center justify-center text-xl mb-3">
          📍
        </div>
        <h3 className="text-base font-bold text-[var(--text-main,#f8fafc)]">
          {t("library.locations.noLocations")}
        </h3>
        <p className="text-xs text-[var(--text-muted,#64748b)] max-w-sm mt-1 mb-4">
          {t("library.locations.subtitle")}
        </p>
        <Button onClick={onAddRootLocation}>
          + {t("library.locations.addLocation")}
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-lg font-bold text-[var(--text-main,#f8fafc)]">
          {t("library.locations.title")}
        </h2>
        <Button onClick={onAddRootLocation} size="sm">
          + {t("library.locations.addLocation")}
        </Button>
      </div>

      <div className="flex flex-col space-y-2">
        {locations.map((node) => (
          <LocationTreeNodeItem
            key={node.id}
            node={node}
            onAddChild={onAddChildLocation}
            onEdit={onEditLocation}
            onDelete={onDeleteLocation}
          />
        ))}
      </div>
    </div>
  );
}
