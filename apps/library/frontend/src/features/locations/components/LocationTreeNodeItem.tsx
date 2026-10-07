import React, { useState } from "react";
import { ChevronDown, ChevronRight, Pencil, Trash2 } from "lucide-react";
import { Badge, Button, useTranslation } from "@alfheim/shared";
import type { LocationNode } from "../types";

interface LocationTreeNodeItemProps {
  node: LocationNode;
  level?: number;
  onAddChild: (parentId: string) => void;
  onEdit: (node: LocationNode) => void;
  onDelete: (node: LocationNode) => void;
}

export function LocationTreeNodeItem({
  node,
  level = 0,
  onAddChild,
  onEdit,
  onDelete,
}: LocationTreeNodeItemProps) {
  const { t } = useTranslation();
  const [isExpanded, setIsExpanded] = useState(true);
  const children = node.children ?? [];
  const hasChildren = children.length > 0;

  return (
    <div className="flex flex-col space-y-2">
      <div
        style={{ paddingLeft: `${level * 1.5}rem` }}
        className="group flex items-center justify-between rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-card)] p-3 transition-colors hover:border-[var(--border-subtle)]"
      >
        <div className="flex items-center space-x-3 min-w-0 flex-1">
          <button
            type="button"
            onClick={() => setIsExpanded(!isExpanded)}
            className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-xs font-semibold text-[var(--text-muted)] hover:bg-[var(--surface-elevated)] ${
              !hasChildren ? "invisible" : ""
            }`}
            aria-label={
              isExpanded
                ? t("library.locations.collapseNode", { name: node.name })
                : t("library.locations.expandNode", { name: node.name })
            }
            aria-expanded={isExpanded}
          >
            {isExpanded ? (
              <ChevronDown className="h-4 w-4" aria-hidden="true" />
            ) : (
              <ChevronRight className="h-4 w-4" aria-hidden="true" />
            )}
          </button>

          <div className="flex flex-col min-w-0 flex-1">
            <div className="flex min-w-0 items-center space-x-2">
              <span className="min-w-0 font-semibold text-[var(--text-main)] truncate">
                {node.name}
              </span>
              {typeof node.itemCount === "number" && (
                <Badge variant="outline" className="shrink-0 text-xs">
                  {t("library.locations.itemCount", { count: node.itemCount })}
                </Badge>
              )}
            </div>
            {node.description && (
              <p className="text-xs text-[var(--text-muted)] truncate mt-0.5">
                {node.description}
              </p>
            )}
          </div>
        </div>

        <div className="ml-2 flex shrink-0 items-center space-x-1 opacity-90 group-hover:opacity-100">
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={() => onAddChild(node.id)}
            aria-label={t("library.locations.addLocation")}
            className="text-xs"
          >
            +<span className="hidden sm:inline">&nbsp;{t("library.locations.addLocation")}</span>
          </Button>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={() => onEdit(node)}
            aria-label={t("library.locations.editAria", { name: node.name })}
            className="text-xs"
          >
            <Pencil className="h-4 w-4" aria-hidden="true" />
          </Button>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={() => onDelete(node)}
            aria-label={t("library.locations.deleteAria", { name: node.name })}
            className="text-xs text-red-400 hover:text-red-300"
          >
            <Trash2 className="h-4 w-4" aria-hidden="true" />
          </Button>
        </div>
      </div>

      {hasChildren && isExpanded && (
        <div className="flex flex-col space-y-2">
          {children.map((child) => (
            <LocationTreeNodeItem
              key={child.id}
              node={child}
              level={level + 1}
              onAddChild={onAddChild}
              onEdit={onEdit}
              onDelete={onDelete}
            />
          ))}
        </div>
      )}
    </div>
  );
}
