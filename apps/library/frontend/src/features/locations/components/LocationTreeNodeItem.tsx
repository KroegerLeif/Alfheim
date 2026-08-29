import React, { useState } from "react";
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
  const hasChildren = node.children && node.children.length > 0;

  return (
    <div className="flex flex-col space-y-2">
      <div
        style={{ paddingLeft: `${level * 1.5}rem` }}
        className="group flex items-center justify-between rounded-xl border border-[var(--border-subtle,#334155)] bg-[var(--surface-card,#1e293b)] p-3 transition-colors hover:border-[var(--border-main,#475569)]"
      >
        <div className="flex items-center space-x-3 min-w-0 flex-1">
          <button
            type="button"
            onClick={() => setIsExpanded(!isExpanded)}
            className={`flex h-6 w-6 items-center justify-center rounded-md text-xs font-semibold text-[var(--text-muted,#94a3b8)] hover:bg-[var(--surface-muted,#0f172a)] ${
              !hasChildren ? "invisible" : ""
            }`}
            aria-label={isExpanded ? "Collapse node" : "Expand node"}
          >
            {isExpanded ? "▼" : "▶"}
          </button>

          <div className="flex flex-col min-w-0 flex-1">
            <div className="flex items-center space-x-2">
              <span className="font-semibold text-[var(--text-main,#f8fafc)] truncate">
                {node.name}
              </span>
              {typeof node.itemCount === "number" && (
                <Badge variant="outline" className="text-xs">
                  {t("library.locations.itemCount", { count: node.itemCount })}
                </Badge>
              )}
            </div>
            {node.description && (
              <p className="text-xs text-[var(--text-muted,#94a3b8)] truncate mt-0.5">
                {node.description}
              </p>
            )}
          </div>
        </div>

        <div className="flex items-center space-x-1 opacity-90 group-hover:opacity-100">
          <Button
            size="sm"
            variant="ghost"
            onClick={() => onAddChild(node.id)}
            className="text-xs"
          >
            + {t("library.locations.addLocation")}
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => onEdit(node)}
            className="text-xs"
          >
            ✏️
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => onDelete(node)}
            className="text-xs text-red-400 hover:text-red-300"
          >
            🗑️
          </Button>
        </div>
      </div>

      {hasChildren && isExpanded && (
        <div className="flex flex-col space-y-2">
          {node.children.map((child) => (
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
