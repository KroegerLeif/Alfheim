"use client";

import { useTranslation, Button, TableRow, TableCell, AlfiAvatar } from "@alfheim/shared";
import { Plus, Minus, AlertTriangle } from "lucide-react";
import { InventoryStateReadWithRelations } from "@/features/inventory/types";
import { usePantryChat } from "@/core/chatContext";

interface InventoryTableRowProps {
  state: InventoryStateReadWithRelations;
  onQuickAction: (mode: "in" | "out") => void;
}

/**
 * InventoryTableRow
 * Renders a single inventory state row with product info, stock level alert badges,
 * expiration status, contextual ALFI assistant trigger, and quick IN/OUT action buttons.
 */
export function InventoryTableRow({ state, onQuickAction }: InventoryTableRowProps) {
  const { t } = useTranslation();
  const { openChat } = usePantryChat();

  const product = state.product;
  const location = state.location;

  if (!product || !location) return null;

  const isExpired = state.expiration_date
    ? new Date(state.expiration_date).getTime() < Date.now()
    : false;
  const isEmpty = state.quantity <= 0;
  const isLowStock = !isEmpty && state.quantity < (product.minimum_stock ?? 0);

  return (
    <TableRow className="border-b border-[var(--border-subtle)] last:border-b-0 hover:bg-[var(--surface-elevated)]/50">
      {/* Product info */}
      <TableCell className="font-sans">
        <div className="font-bold uppercase text-sm tracking-tight text-[var(--text-main)]">{product.name}</div>
        {product.brand && (
          <div className="text-[10px] text-[var(--text-muted)] uppercase tracking-wider mt-0.5 font-mono">{product.brand}</div>
        )}
      </TableCell>

      {/* Location */}
      <TableCell className="uppercase text-[var(--text-main)] font-mono text-xs">{location.name}</TableCell>

      {/* Stock level */}
      <TableCell className="text-right">
        <div className="flex items-center justify-end gap-1.5 font-bold font-mono">
          {isLowStock && <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />}
          <span className={isEmpty ? "text-red-500 font-black" : isLowStock ? "text-amber-500 font-bold" : "text-[var(--text-main)]"}>
            {state.quantity.toFixed(1)}
          </span>
          <span className="text-[10px] text-[var(--text-muted)] font-normal uppercase">{product.base_unit}</span>
        </div>
      </TableCell>

      {/* Expiration */}
      <TableCell className="font-mono text-xs">
        {state.expiration_date ? (
          <span className={isExpired ? "text-red-500 font-bold" : "text-[var(--text-main)]"}>
            {state.expiration_date}{isExpired && ` [${t("pantry.expired")}]`}
          </span>
        ) : (
          <span className="text-[var(--text-muted)] font-normal">--</span>
        )}
      </TableCell>

      {/* Quick actions & ALFI trigger */}
      <TableCell className="text-right">
        <div className="flex items-center justify-end gap-2">
          <Button
            onClick={() =>
              openChat({
                sourceApp: "pantry",
                entityType: "product",
                entityId: product.id,
                entityData: {
                  name: product.name,
                  barcode: product.barcode,
                  quantity: state.quantity,
                  location: location.name,
                  base_unit: product.base_unit,
                },
              })
            }
            variant="outline"
            size="sm"
            aria-label={`${t("pantry.askAlfi")}: ${product.name}`}
            title={t("pantry.askAlfiAboutProduct")}
            className="h-8 px-2 border-[var(--border-subtle)] hover:border-[var(--primary-main)] bg-[var(--surface-card)] hover:bg-[var(--surface-canvas)] cursor-pointer"
          >
            <AlfiAvatar status="idle" size="sm" />
          </Button>
          <Button onClick={() => onQuickAction("in")} variant="outline" size="sm"
            className="h-8 text-[10px] px-2.5 font-black uppercase tracking-wider text-emerald-400 border-emerald-800/40 bg-emerald-950/20 hover:bg-emerald-900/40 cursor-pointer">
            <Plus className="h-3 w-3 mr-0.5" />{t("pantry.actionIn")}
          </Button>
          <Button onClick={() => onQuickAction("out")} variant="outline" size="sm"
            className="h-8 text-[10px] px-2.5 font-black uppercase tracking-wider text-red-400 border-red-800/40 bg-red-950/20 hover:bg-red-900/40 cursor-pointer">
            <Minus className="h-3 w-3 mr-0.5" />{t("pantry.actionOut")}
          </Button>
        </div>
      </TableCell>
    </TableRow>
  );
}
