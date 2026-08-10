"use client";

import { useTranslation } from "@alfheim/shared";
import { TableRow, TableCell } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { ProductRead } from "@/features/products/types";
import { LocationRead } from "@/features/locations/types";

interface LedgerEntry {
  id: string;
  created_at: string;
  product_id: string;
  location_id: string;
  transaction_type: string;
  quantity: number;
  unit_input?: string | null;
  batch_code?: string | null;
  notes?: string | null;
}

interface LedgerTableRowProps {
  entry: LedgerEntry;
  product: ProductRead | undefined;
  location: LocationRead | undefined;
}

function formatDateTime(dateStr: string): string {
  try {
    const d = new Date(dateStr);
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
  } catch {
    return dateStr;
  }
}

const TX_CLASS: Record<string, string> = {
  in: "bg-emerald-950/20 border-emerald-800/40 text-emerald-400",
  out: "bg-[var(--surface-elevated)] border-[var(--border-subtle)] text-[var(--text-main)]",
  waste: "bg-red-950/20 border-red-800/40 text-red-400",
};

/**
 * LedgerTableRow
 * Renders a single audit ledger entry row with resolved product/location names,
 * signed quantity formatting, and transaction type badge.
 */
export function LedgerTableRow({ entry, product, location }: LedgerTableRowProps) {
  const { t } = useTranslation();
  const isPositive = entry.quantity > 0;
  const formattedQty = isPositive ? `+${entry.quantity.toFixed(1)}` : `${entry.quantity.toFixed(1)}`;
  const txClass = TX_CLASS[entry.transaction_type] ?? "bg-sky-950/20 border-sky-800/40 text-sky-400";

  return (
    <TableRow className="border-b border-[var(--border-subtle)] last:border-b-0 hover:bg-[var(--surface-elevated)]/50">
      <TableCell className="text-xs font-mono text-[var(--text-muted)]">{formatDateTime(entry.created_at)}</TableCell>

      <TableCell className="font-sans font-bold uppercase text-xs tracking-tight text-[var(--text-main)]">
        {product?.name ?? t("pantry.unknownProduct")}
        {product?.brand && (
          <span className="block text-[9px] text-[var(--text-muted)] font-mono font-normal tracking-wide lowercase mt-0.5">
            brand: {product.brand}
          </span>
        )}
      </TableCell>

      <TableCell>
        <Badge variant="outline" className={`text-[9px] font-bold ${txClass}`}>
          {entry.transaction_type.toUpperCase()}
        </Badge>
      </TableCell>

      <TableCell className="text-right font-black font-mono">
        <span className={isPositive ? "text-emerald-400" : "text-red-400"}>{formattedQty}</span>
        <span className="text-[10px] text-[var(--text-muted)] font-normal uppercase ml-1 font-sans">
          {entry.unit_input ?? product?.base_unit}
        </span>
      </TableCell>

      <TableCell className="uppercase text-xs font-semibold text-[var(--text-main)]">
        {location?.name ?? t("pantry.unknownLocation")}
      </TableCell>

      <TableCell className="text-xs max-w-[200px] truncate">
        {entry.batch_code && (
          <div className="font-bold text-[9px] bg-[var(--surface-elevated)] border border-[var(--border-subtle)] px-1 py-0.5 inline-block mb-1 text-[var(--primary-main)] rounded">
            BATCH: {entry.batch_code.toUpperCase()}
          </div>
        )}
        {entry.notes ? (
          <div className="text-[var(--text-muted)] font-sans italic text-[11px] truncate">{entry.notes}</div>
        ) : (
          !entry.batch_code && <span className="text-[var(--text-muted)]">--</span>
        )}
      </TableCell>
    </TableRow>
  );
}
