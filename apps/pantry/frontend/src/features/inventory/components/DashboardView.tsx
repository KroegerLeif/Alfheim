"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { 
  useInventoryState, 
  useLowStockItems, 
  useExpirationSummary, 
  exportLowStockShoppingList 
} from "@/features/inventory/services/inventoryService";
import { StockActionModal } from "./StockActionModal";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  Plus, 
  Minus, 
  Check, 
  Download, 
  Loader2 
} from "lucide-react";

/**
 * DashboardView Component
 * Renders the main operational panel of the Pantry Application.
 * Consists of 4 metric summary chips, touch-optimized stock IN/OUT transaction row cards,
 * and a sorted urgency feed representing batches requiring physical inspections.
 */
export function DashboardView() {
  const t = useTranslations("Dashboard");

  // Load backend data contexts using React Query hooks
  const { data: states = [], isLoading: isLoadingStates } = useInventoryState();
  const { data: lowStockItems = [], isLoading: isLoadingLowStock } = useLowStockItems();
  const { data: expirationSummary, isLoading: isLoadingExp } = useExpirationSummary();

  // Dialog and action states
  const [modalMode, setModalMode] = React.useState<"in" | "out">("in");
  const [isModalOpen, setIsModalOpen] = React.useState(false);
  const [isExporting, setIsExporting] = React.useState(false);
  const [exportSuccess, setExportSuccess] = React.useState(false);

  // Compute operational aggregates
  const totalStockQuantity = states.reduce((sum, item) => sum + item.quantity, 0);
  const uniqueItemsCount = states.length;
  
  const expiredCount = expirationSummary?.expired?.length || 0;
  const lowStockCount = lowStockItems.length;
  const untrackedCount = expirationSummary?.untracked?.length || 0;

  const handleOpenModal = (mode: "in" | "out") => {
    setModalMode(mode);
    setIsModalOpen(true);
  };

  const handleExport = async () => {
    setIsExporting(true);
    setExportSuccess(false);
    try {
      const payload = await exportLowStockShoppingList();
      
      // Generate client-side file download for tablet environments
      const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(payload, null, 2));
      const downloadAnchor = document.createElement("a");
      downloadAnchor.setAttribute("href", dataStr);
      downloadAnchor.setAttribute("download", `loeger_pantry_low_stock_${new Date().toISOString().slice(0, 10)}.json`);
      document.body.appendChild(downloadAnchor);
      downloadAnchor.click();
      downloadAnchor.remove();

      setExportSuccess(true);
      setTimeout(() => setExportSuccess(false), 3000);
    } catch (err) {
      console.error("Failed to export shopping list:", err);
    } finally {
      setIsExporting(false);
    }
  };

  // Compile active alerts feed sorted by urgency (expired > expiring within 14 days)
  const alertFeed = React.useMemo(() => {
    const expiredFeed = (expirationSummary?.expired || []).map(item => ({
      ...item,
      severity: "high" as const,
    }));

    const warningFeed = (expirationSummary?.valid || [])
      .filter(item => {
        if (!item.expiration_date) return false;
        const expDate = new Date(item.expiration_date);
        const diffDays = Math.ceil((expDate.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));
        return diffDays >= 0 && diffDays <= 14; // expiring in next 14 days
      })
      .map(item => ({
        ...item,
        severity: "medium" as const,
      }));

    // Merge feeds: High severity (expired) first, then sort warnings by closest date
    return [
      ...expiredFeed,
      ...warningFeed.sort((a, b) => {
        if (!a.expiration_date || !b.expiration_date) return 0;
        return new Date(a.expiration_date).getTime() - new Date(b.expiration_date).getTime();
      })
    ];
  }, [expirationSummary]);

  const isLoadingMetrics = isLoadingStates || isLoadingLowStock || isLoadingExp;

  return (
    <div className="flex-1 p-6 md:p-12 space-y-10 max-w-7xl mx-auto w-full select-none">
      
      {/* 4-COLUMN SUMMARY METRIC GRID */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 font-mono">
        
        {/* Card 1: Total unique lines */}
        <div className="border border-border p-6 bg-background flex flex-col justify-between h-36">
          <div className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">
            Total Stock Lines
          </div>
          <div className="flex items-baseline gap-2 mt-2">
            <span className="text-4xl font-black">
              {isLoadingMetrics ? "--" : uniqueItemsCount}
            </span>
            <span className="text-xs text-muted-foreground uppercase">
              ({isLoadingMetrics ? "--" : totalStockQuantity.toFixed(1)} qty)
            </span>
          </div>
          <div className="text-[9px] text-neutral-400 mt-2 uppercase">
            Registered unique batches
          </div>
        </div>

        {/* Card 2: Expiration alarms */}
        <div className={`border p-6 flex flex-col justify-between h-36 transition-colors ${
          expiredCount > 0 ? "border-red-600 bg-red-50 text-red-950" : "border-border bg-background"
        }`}>
          <div className="text-[10px] uppercase font-bold tracking-wider">
            Expiration Alerts
          </div>
          <div className="text-4xl font-black mt-2">
            {isLoadingMetrics ? "--" : expiredCount}
          </div>
          <div className="text-[9px] uppercase">
            {expiredCount > 0 ? "Immediate physical audit required" : "All batches currently valid"}
          </div>
        </div>

        {/* Card 3: Stock threshold warnings */}
        <div className={`border p-6 flex flex-col justify-between h-36 transition-colors ${
          lowStockCount > 0 ? "border-amber-600 bg-amber-50 text-amber-950" : "border-border bg-background"
        }`}>
          <div className="text-[10px] uppercase font-bold tracking-wider">
            Low Stock Lines
          </div>
          <div className="text-4xl font-black mt-2">
            {isLoadingMetrics ? "--" : lowStockCount}
          </div>
          <div className="text-[9px] uppercase">
            {lowStockCount > 0 ? "Threshold warning active" : "Stock meets minimum quotas"}
          </div>
        </div>

        {/* Card 4: Untracked expiration counts */}
        <div className="border border-border p-6 bg-background flex flex-col justify-between h-36">
          <div className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">
            Untracked Batches
          </div>
          <div className="text-4xl font-black mt-2">
            {isLoadingMetrics ? "--" : untrackedCount}
          </div>
          <div className="text-[9px] text-neutral-400 uppercase">
            No expiration code mapped
          </div>
        </div>

      </div>

      {/* DUAL QUICK ACTION ROW */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 font-mono">
        
        {/* STOCK IN QUICK ACCESS */}
        <button
          onClick={() => handleOpenModal("in")}
          className="border-2 border-border h-32 px-8 flex items-center justify-between text-left hover:bg-emerald-50 hover:border-emerald-600 hover:text-emerald-950 transition-all duration-200 cursor-pointer group"
        >
          <div>
            <div className="text-sm font-bold uppercase tracking-wider text-muted-foreground group-hover:text-emerald-800">
              Quick Transaction
            </div>
            <h2 className="text-4xl font-black uppercase mt-1">
              Stock In (+)
            </h2>
          </div>
          <div className="h-14 w-14 border border-border flex items-center justify-center bg-background group-hover:border-emerald-600 group-hover:bg-emerald-100 transition-colors">
            <Plus className="h-6 w-6 text-foreground group-hover:text-emerald-950" />
          </div>
        </button>

        {/* STOCK OUT QUICK ACCESS */}
        <button
          onClick={() => handleOpenModal("out")}
          className="border-2 border-border h-32 px-8 flex items-center justify-between text-left hover:bg-red-50 hover:border-red-600 hover:text-red-950 transition-all duration-200 cursor-pointer group"
        >
          <div>
            <div className="text-sm font-bold uppercase tracking-wider text-muted-foreground group-hover:text-red-800">
              Quick Transaction
            </div>
            <h2 className="text-4xl font-black uppercase mt-1">
              Stock Out (-)
            </h2>
          </div>
          <div className="h-14 w-14 border border-border flex items-center justify-center bg-background group-hover:border-red-600 group-hover:bg-red-100 transition-colors">
            <Minus className="h-6 w-6 text-foreground group-hover:text-red-950" />
          </div>
        </button>

      </div>

      {/* DETAIL ALERTS FEED & SHOPPING ACTION LAYOUT */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Urgent batch expiration logs */}
        <div className="lg:col-span-2 border border-border p-6 flex flex-col min-h-[400px]">
          <h2 className="font-heading text-2xl font-black border-b border-border pb-3 mb-4 uppercase tracking-wide">
            Critical Expiration Logs
          </h2>
          
          {isLoadingMetrics ? (
            <div className="flex-1 flex items-center justify-center font-mono text-xs text-muted-foreground">
              Retrieving alert feed...
            </div>
          ) : alertFeed.length === 0 ? (
            <div className="flex-1 flex items-center justify-center font-mono text-xs text-neutral-400">
              [ NO EXPIRATION ALERTS REGISTERED ]
            </div>
          ) : (
            <div className="flex-1 overflow-y-auto space-y-3 max-h-[350px] pr-1">
              {alertFeed.map((alert) => (
                <div 
                  key={alert.id} 
                  className={`border p-4 flex items-center justify-between font-mono ${
                    alert.severity === "high" 
                      ? "border-red-600 bg-red-50/50 text-red-950" 
                      : "border-amber-600 bg-amber-50/30 text-amber-950"
                  }`}
                >
                  <div>
                    <div className="font-black uppercase text-sm tracking-tight">
                      {alert.product?.name}
                    </div>
                    <div className="text-[10px] text-muted-foreground mt-0.5 uppercase">
                      Location: {alert.location?.name} | Batch: {alert.batch_code || "NONE"}
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <div className="font-bold text-xs uppercase">
                        EXPIRING
                      </div>
                      <div className="text-[10px] font-bold mt-0.5">
                        {alert.expiration_date}
                      </div>
                    </div>

                    <Badge variant={alert.severity === "high" ? "destructive" : "outline"} className="text-[9px]">
                      {alert.severity === "high" ? "EXPIRED" : "SOON"}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Low-stock Shopping List Action Panel */}
        <div className="border border-border p-6 flex flex-col justify-between min-h-[400px] bg-neutral-50 font-mono">
          <div>
            <h2 className="font-heading text-2xl font-black border-b border-border pb-3 mb-4 uppercase tracking-wide text-foreground">
              Shopping List
            </h2>
            <p className="text-xs text-muted-foreground uppercase leading-relaxed tracking-wide">
              Generates an auto-export of products that violate local home threshold quotas. Forwards transaction data directly to warehouse logistics.
            </p>

            <div className="mt-6 space-y-3">
              <div className="text-xs uppercase font-bold text-neutral-400">
                Quota Violations
              </div>
              {isLoadingMetrics ? (
                <div className="text-xs text-muted-foreground">Calculating...</div>
              ) : (
                <div className="space-y-2 max-h-[160px] overflow-y-auto">
                  {lowStockItems.length === 0 ? (
                    <div className="text-xs text-neutral-400">[ ALL QUOTAS SATISFIED ]</div>
                  ) : (
                    lowStockItems.map((item, idx) => (
                      <div key={idx} className="flex justify-between items-center text-xs border-b border-neutral-200 pb-1.5">
                        <span className="font-bold uppercase truncate max-w-[150px]">{item.product.name}</span>
                        <span className="text-[10px] text-muted-foreground">
                          {item.current_stock.toFixed(1)} / {item.product.minimum_stock.toFixed(0)} Min
                        </span>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
          </div>

          <div className="pt-6">
            <Button
              onClick={handleExport}
              disabled={isExporting || lowStockCount === 0}
              variant="outline"
              className="w-full py-6 text-xs font-black tracking-widest border-2 border-black hover:bg-black hover:text-white cursor-pointer select-none transition-all flex items-center justify-center gap-2"
            >
              {isExporting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  EXPORTING LOGISTICS...
                </>
              ) : exportSuccess ? (
                <>
                  <Check className="h-4 w-4 text-green-600" />
                  LIST EXPORTED [JSON]
                </>
              ) : (
                <>
                  <Download className="h-4 w-4" />
                  {t("exportList")}
                </>
              )}
            </Button>
          </div>
        </div>

      </div>

      {/* STOCK ACTION INPUT MODAL */}
      <StockActionModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        mode={modalMode}
      />
    </div>
  );
}
