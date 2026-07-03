"use client";

import * as React from "react";
import { useLedgerHistory } from "@/features/inventory/services/inventoryService";
import { useLocations } from "@/features/locations/services/locationService";
import { useProducts } from "@/features/products/services/productService";
import { 
  Table, 
  TableHeader, 
  TableBody, 
  TableRow, 
  TableHead, 
  TableCell 
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { RefreshCw } from "lucide-react";

/**
 * LedgerHistoryView Component
 * Renders the chronological audit log of physical stock updates.
 * Dynamically resolves product_id and location_id relation properties client-side.
 * Connects filters for quick inspection of movements by storage place or product name.
 */
export function LedgerHistoryView() {
  const { data: ledger = [], isLoading: isLoadingLedger, refetch } = useLedgerHistory();
  const { data: locations = [] } = useLocations();
  const { data: products = [] } = useProducts();

  // Dropdown filter parameters
  const [filterLocationId, setFilterLocationId] = React.useState("");
  const [filterProductId, setFilterProductId] = React.useState("");

  // Map array contexts to quick lookup maps
  const productMap = React.useMemo(() => new Map(products.map(p => [p.id, p])), [products]);
  const locationMap = React.useMemo(() => new Map(locations.map(l => [l.id, l])), [locations]);

  // Format transaction timestamps locally
  const formatDateTime = (dateStr: string) => {
    try {
      const d = new Date(dateStr);
      const pad = (num: number) => String(num).padStart(2, "0");
      return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
    } catch {
      return dateStr;
    }
  };

  // Perform client-side filter computation
  const filteredLedger = React.useMemo(() => {
    return ledger.filter((entry) => {
      const matchesLocation = !filterLocationId || entry.location_id === filterLocationId;
      const matchesProduct = !filterProductId || entry.product_id === filterProductId;
      return matchesLocation && matchesProduct;
    });
  }, [ledger, filterLocationId, filterProductId]);

  return (
    <div className="flex-1 p-6 md:p-12 space-y-6 max-w-7xl mx-auto w-full select-none font-mono">
      
      {/* Header section */}
      <header className="border-b border-border pb-4 flex justify-between items-baseline gap-4">
        <div>
          <h1 className="text-4xl font-heading font-black tracking-wide text-foreground uppercase">
            Ledger Audit Log
          </h1>
          <p className="text-xs text-muted-foreground mt-1 uppercase tracking-wider">
            Chronological log of physical stock movements
          </p>
        </div>
        <Button 
          variant="outline" 
          size="sm" 
          onClick={() => refetch()} 
          className="h-8 text-xs uppercase tracking-wider gap-1 cursor-pointer"
        >
          <RefreshCw className="h-3 w-3" />
          Refresh
        </Button>
      </header>

      {/* FILTER CONTROLS BAR */}
      <div className="flex flex-col md:flex-row gap-4">
        
        {/* Product selector filter */}
        <select
          value={filterProductId}
          onChange={(e) => setFilterProductId(e.target.value)}
          className="py-2.5 px-3 border border-border bg-background focus:outline-none focus:ring-1 focus:ring-ring text-xs uppercase h-11 min-w-[220px] cursor-pointer"
        >
          <option value="">Filter by Product</option>
          {products.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name.toUpperCase()}
            </option>
          ))}
        </select>

        {/* Location selector filter */}
        <select
          value={filterLocationId}
          onChange={(e) => setFilterLocationId(e.target.value)}
          className="py-2.5 px-3 border border-border bg-background focus:outline-none focus:ring-1 focus:ring-ring text-xs uppercase h-11 min-w-[220px] cursor-pointer"
        >
          <option value="">Filter by Location</option>
          {locations.map((loc) => (
            <option key={loc.id} value={loc.id}>
              {loc.name.toUpperCase()}
            </option>
          ))}
        </select>

      </div>

      {/* AUDIT LOG TABLE */}
      <div className="border border-border bg-background">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[18%]">Timestamp</TableHead>
              <TableHead className="w-[22%] font-heading">Product</TableHead>
              <TableHead className="w-[15%]">Type</TableHead>
              <TableHead className="w-[15%] text-right">Adjustment</TableHead>
              <TableHead className="w-[15%]">Location</TableHead>
              <TableHead className="w-[15%]">Batch/Notes</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoadingLedger ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-10 text-xs text-muted-foreground uppercase">
                  Loading ledger history...
                </TableCell>
              </TableRow>
            ) : filteredLedger.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-10 text-xs text-neutral-400 uppercase">
                  [ No audit logs recorded ]
                </TableCell>
              </TableRow>
            ) : (
              filteredLedger.map((entry) => {
                const product = productMap.get(entry.product_id);
                const location = locationMap.get(entry.location_id);
                
                const isPositive = entry.quantity > 0;
                const formattedQty = isPositive 
                  ? `+${entry.quantity.toFixed(1)}` 
                  : `${entry.quantity.toFixed(1)}`;

                const typeString = entry.transaction_type.toUpperCase();

                return (
                  <TableRow key={entry.id}>
                    {/* Log entry timestamp */}
                    <TableCell className="text-xs font-mono text-neutral-600">
                      {formatDateTime(entry.created_at)}
                    </TableCell>

                    {/* Product blueprint */}
                    <TableCell className="font-sans font-bold uppercase text-xs tracking-tight text-foreground">
                      {product?.name || "Unknown Product"}
                      {product?.brand && (
                        <span className="block text-[9px] text-muted-foreground font-mono font-normal tracking-wide lowercase mt-0.5">
                          brand: {product.brand}
                        </span>
                      )}
                    </TableCell>

                    {/* Transaction type representation */}
                    <TableCell>
                      <Badge 
                        variant="outline" 
                        className={`text-[9px] font-bold ${
                          entry.transaction_type === "in"
                            ? "bg-emerald-50 border-emerald-600 text-emerald-900"
                            : entry.transaction_type === "out"
                            ? "bg-neutral-100 border-neutral-300 text-neutral-800"
                            : entry.transaction_type === "waste"
                            ? "bg-red-50 border-red-600 text-red-900"
                            : "bg-sky-50 border-sky-600 text-sky-900"
                        }`}
                      >
                        {typeString}
                      </Badge>
                    </TableCell>

                    {/* Signed quantity movement */}
                    <TableCell className="text-right font-black font-mono">
                      <span className={isPositive ? "text-emerald-700" : "text-red-700"}>
                        {formattedQty}
                      </span>
                      <span className="text-[10px] text-muted-foreground font-normal uppercase ml-1 font-sans">
                        {entry.unit_input || product?.base_unit}
                      </span>
                    </TableCell>

                    {/* Movement destination location */}
                    <TableCell className="uppercase text-xs font-semibold">
                      {location?.name || "Unknown Location"}
                    </TableCell>

                    {/* Context metadata (batches/notes) */}
                    <TableCell className="text-xs max-w-[200px] truncate">
                      {entry.batch_code && (
                        <div className="font-bold text-[9px] bg-neutral-100 border border-neutral-200 px-1 py-0.5 inline-block mb-1">
                          BATCH: {entry.batch_code.toUpperCase()}
                        </div>
                      )}
                      {entry.notes ? (
                        <div className="text-muted-foreground font-sans italic text-[11px] truncate">
                          {entry.notes}
                        </div>
                      ) : (
                        !entry.batch_code && <span className="text-neutral-300">--</span>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

    </div>
  );
}
