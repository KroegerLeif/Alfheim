"use client";

import * as React from "react";
import { useTranslation } from "@alfheim/shared";
import { useLedgerHistory } from "@/features/inventory/services/inventoryService";
import { useLocations } from "@/features/locations/services/locationService";
import { useProducts } from "@/features/products/services/productService";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { RefreshCw } from "lucide-react";
import { LedgerFilterBar } from "./LedgerFilterBar";
import { LedgerTableRow } from "./LedgerTableRow";

/**
 * LedgerHistoryView
 * Orchestrates the chronological audit log of physical stock updates.
 * Delegates filter bar to LedgerFilterBar and row rendering to LedgerTableRow.
 */
export function LedgerHistoryView() {
  const { t } = useTranslation();
  const { data: ledger = [], isLoading, isError, refetch } = useLedgerHistory();
  const { data: locations = [] } = useLocations();
  const { data: products = [] } = useProducts();

  const [filterLocationId, setFilterLocationId] = React.useState("");
  const [filterProductId, setFilterProductId] = React.useState("");

  // O(1) lookups for product/location resolution
  const productMap = React.useMemo(() => new Map(products.map((p) => [p.id, p])), [products]);
  const locationMap = React.useMemo(() => new Map(locations.map((l) => [l.id, l])), [locations]);

  const filteredLedger = React.useMemo(() =>
    ledger.filter((entry) =>
      (!filterLocationId || entry.location_id === filterLocationId) &&
      (!filterProductId || entry.product_id === filterProductId)
    ),
    [ledger, filterLocationId, filterProductId]
  );

  return (
    <div className="flex-1 p-6 md:p-12 space-y-6 max-w-7xl mx-auto w-full select-none font-mono text-[var(--text-main)]">
      <header className="border-b border-[var(--border-subtle)] pb-4 flex justify-between items-baseline gap-4">
        <div>
          <h1 className="text-4xl font-heading font-black tracking-wide text-[var(--text-main)] uppercase">{t("pantry.ledgerTitle")}</h1>
          <p className="text-xs text-[var(--text-muted)] mt-1 uppercase tracking-wider">{t("pantry.ledgerSub")}</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => refetch()}
          className="h-8 text-xs uppercase tracking-wider gap-1 cursor-pointer border-[var(--border-subtle)] hover:bg-[var(--surface-elevated)]">
          <RefreshCw className="h-3 w-3" />{t("pantry.refresh")}
        </Button>
      </header>

      <LedgerFilterBar
        filterProductId={filterProductId} onProductChange={setFilterProductId}
        filterLocationId={filterLocationId} onLocationChange={setFilterLocationId}
        products={products} locations={locations}
      />

      <div className="border border-[var(--border-subtle)] bg-[var(--surface-card)] rounded-lg shadow-sm">
        <Table>
          <TableHeader>
            <TableRow className="border-b border-[var(--border-subtle)]">
              <TableHead className="w-[18%] text-[var(--text-muted)]">{t("pantry.timestamp")}</TableHead>
              <TableHead className="w-[22%] font-heading text-[var(--text-muted)]">{t("pantry.product")}</TableHead>
              <TableHead className="w-[15%] text-[var(--text-muted)]">{t("pantry.type")}</TableHead>
              <TableHead className="w-[15%] text-right text-[var(--text-muted)]">{t("pantry.adjustment")}</TableHead>
              <TableHead className="w-[15%] text-[var(--text-muted)]">{t("pantry.location")}</TableHead>
              <TableHead className="w-[15%] text-[var(--text-muted)]">{t("pantry.batchNotes")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isError ? (
              <TableRow><TableCell colSpan={6} className="text-center py-10 text-xs font-bold text-rose-400 uppercase">Failed to load transaction ledger records.</TableCell></TableRow>
            ) : isLoading ? (
              <TableRow><TableCell colSpan={6} className="text-center py-10 text-xs text-[var(--text-muted)] uppercase">{t("pantry.loadingHistory")}</TableCell></TableRow>
            ) : filteredLedger.length === 0 ? (
              <TableRow><TableCell colSpan={6} className="text-center py-10 text-xs text-[var(--text-muted)] uppercase">{t("pantry.noAuditLogs")}</TableCell></TableRow>
            ) : (
              filteredLedger.map((entry) => (
                <LedgerTableRow
                  key={entry.id}
                  entry={entry}
                  product={productMap.get(entry.product_id)}
                  location={locationMap.get(entry.location_id)}
                />
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
