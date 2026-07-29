"use client";

import * as React from "react";
import { useTranslation } from "@loeger-os/shared";
import { 
  useInventoryState, 
  useLowStockItems, 
  useExpirationSummary, 
  pushLowStockToShoppingApp 
} from "@/features/inventory/services/inventoryService";
import { StockActionModal } from "./StockActionModal";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  Plus, 
  Minus, 
  Check, 
  Send, 
  Loader2 
} from "lucide-react";

/**
 * DashboardView Component
 * Renders the main operational panel of the Digital Pantry.
 * Consists of metric summary chips, touch-optimized stock IN/OUT transaction row cards,
 * urgency expiration feed, and live inter-service Shopping App sync.
 */
export function DashboardView() {
  const { t } = useTranslation();

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
      const res = await pushLowStockToShoppingApp();
      if (res.success) {
        setExportSuccess(true);
        setTimeout(() => setExportSuccess(false), 3000);
      }
    } catch (err) {
      console.error("Failed to sync low stock items with shopping app:", err);
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
        return diffDays >= 0 && diffDays <= 14;
      })
      .map(item => ({
        ...item,
        severity: "medium" as const,
      }));

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
    <div className="flex-1 p-6 md:p-12 space-y-10 max-w-7xl mx-auto w-full select-none text-[var(--text-main)]">
      
      {/* 4-COLUMN SUMMARY METRIC GRID */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 font-mono">
        
        {/* Card 1: Total unique lines */}
        <div className="border border-[var(--border-subtle)] p-6 bg-[var(--surface-card)] flex flex-col justify-between h-36 rounded-lg shadow-sm">
          <div className="text-[10px] text-[var(--text-muted)] uppercase font-bold tracking-wider">
            {t("pantry.totalStockLines")}
          </div>
          <div className="flex items-baseline gap-2 mt-2">
            <span className="text-4xl font-black text-[var(--text-main)]">
              {isLoadingMetrics ? "--" : uniqueItemsCount}
            </span>
            <span className="text-xs text-[var(--text-muted)] uppercase">
              ({isLoadingMetrics ? "--" : totalStockQuantity.toFixed(1)} {t("pantry.quantity").toLowerCase()})
            </span>
          </div>
          <div className="text-[9px] text-[var(--text-muted)] mt-2 uppercase">
            {t("pantry.registeredBatches")}
          </div>
        </div>

        {/* Card 2: Expiration alarms */}
        <div className={`border p-6 flex flex-col justify-between h-36 rounded-lg shadow-sm transition-colors ${
          expiredCount > 0 
            ? "border-red-600/60 bg-red-950/20 text-red-400" 
            : "border-[var(--border-subtle)] bg-[var(--surface-card)] text-[var(--text-main)]"
        }`}>
          <div className="text-[10px] uppercase font-bold tracking-wider">
            {t("pantry.expirationAlerts")}
          </div>
          <div className="text-4xl font-black mt-2">
            {isLoadingMetrics ? "--" : expiredCount}
          </div>
          <div className="text-[9px] uppercase font-mono">
            {expiredCount > 0 ? t("pantry.immediateAudit") : t("pantry.allValid")}
          </div>
        </div>

        {/* Card 3: Stock threshold warnings */}
        <div className={`border p-6 flex flex-col justify-between h-36 rounded-lg shadow-sm transition-colors ${
          lowStockCount > 0 
            ? "border-amber-600/60 bg-amber-950/20 text-amber-400" 
            : "border-[var(--border-subtle)] bg-[var(--surface-card)] text-[var(--text-main)]"
        }`}>
          <div className="text-[10px] uppercase font-bold tracking-wider">
            {t("pantry.lowStockLines")}
          </div>
          <div className="text-4xl font-black mt-2">
            {isLoadingMetrics ? "--" : lowStockCount}
          </div>
          <div className="text-[9px] uppercase font-mono">
            {lowStockCount > 0 ? t("pantry.thresholdWarning") : t("pantry.stockQuotasMet")}
          </div>
        </div>

        {/* Card 4: Untracked expiration counts */}
        <div className="border border-[var(--border-subtle)] p-6 bg-[var(--surface-card)] flex flex-col justify-between h-36 rounded-lg shadow-sm">
          <div className="text-[10px] text-[var(--text-muted)] uppercase font-bold tracking-wider">
            {t("pantry.untrackedBatches")}
          </div>
          <div className="text-4xl font-black mt-2 text-[var(--text-main)]">
            {isLoadingMetrics ? "--" : untrackedCount}
          </div>
          <div className="text-[9px] text-[var(--text-muted)] uppercase font-mono">
            {t("pantry.noExpirationMapped")}
          </div>
        </div>

      </div>

      {/* DUAL QUICK ACTION ROW */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 font-mono">
        
        {/* STOCK IN QUICK ACCESS */}
        <button
          onClick={() => handleOpenModal("in")}
          className="border-2 border-[var(--border-subtle)] bg-[var(--surface-card)] h-32 px-8 flex items-center justify-between text-left hover:border-[var(--primary-main)] hover:bg-[var(--surface-elevated)] transition-all duration-200 cursor-pointer group rounded-lg shadow-sm"
        >
          <div>
            <div className="text-sm font-bold uppercase tracking-wider text-[var(--text-muted)] group-hover:text-[var(--primary-main)]">
              {t("pantry.quickTransaction")}
            </div>
            <h2 className="text-4xl font-black uppercase mt-1 text-[var(--text-main)]">
              {t("pantry.stockIn")}
            </h2>
          </div>
          <div className="h-14 w-14 border border-[var(--border-subtle)] flex items-center justify-center bg-[var(--surface-canvas)] group-hover:border-[var(--primary-main)] group-hover:bg-[var(--primary-main)]/10 transition-colors rounded-lg">
            <Plus className="h-6 w-6 text-[var(--text-main)] group-hover:text-[var(--primary-main)]" />
          </div>
        </button>

        {/* STOCK OUT QUICK ACCESS */}
        <button
          onClick={() => handleOpenModal("out")}
          className="border-2 border-[var(--border-subtle)] bg-[var(--surface-card)] h-32 px-8 flex items-center justify-between text-left hover:border-red-500 hover:bg-red-950/10 transition-all duration-200 cursor-pointer group rounded-lg shadow-sm"
        >
          <div>
            <div className="text-sm font-bold uppercase tracking-wider text-[var(--text-muted)] group-hover:text-red-400">
              {t("pantry.quickTransaction")}
            </div>
            <h2 className="text-4xl font-black uppercase mt-1 text-[var(--text-main)]">
              {t("pantry.stockOut")}
            </h2>
          </div>
          <div className="h-14 w-14 border border-[var(--border-subtle)] flex items-center justify-center bg-[var(--surface-canvas)] group-hover:border-red-500 group-hover:bg-red-950/20 transition-colors rounded-lg">
            <Minus className="h-6 w-6 text-[var(--text-main)] group-hover:text-red-400" />
          </div>
        </button>

      </div>

      {/* DETAIL ALERTS FEED & SHOPPING ACTION LAYOUT */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 font-mono">
        
        {/* Urgent batch expiration logs */}
        <div className="lg:col-span-2 border border-[var(--border-subtle)] bg-[var(--surface-card)] p-6 flex flex-col min-h-[400px] rounded-lg shadow-sm">
          <h2 className="font-heading text-2xl font-black border-b border-[var(--border-subtle)] pb-3 mb-4 uppercase tracking-wide text-[var(--text-main)]">
            {t("pantry.criticalLogs")}
          </h2>
          
          {isLoadingMetrics ? (
            <div className="flex-1 flex items-center justify-center text-xs text-[var(--text-muted)]">
              {t("pantry.retrievingAlerts")}
            </div>
          ) : alertFeed.length === 0 ? (
            <div className="flex-1 flex items-center justify-center text-xs text-[var(--text-muted)]">
              {t("pantry.noAlerts")}
            </div>
          ) : (
            <div className="flex-1 overflow-y-auto space-y-3 max-h-[350px] pr-1">
              {alertFeed.map((alert) => (
                <div 
                  key={alert.id} 
                  className={`border p-4 flex items-center justify-between rounded ${
                    alert.severity === "high" 
                      ? "border-red-800/40 bg-red-950/20 text-red-400" 
                      : "border-amber-800/40 bg-amber-950/20 text-amber-400"
                  }`}
                >
                  <div>
                    <div className="font-black uppercase text-sm tracking-tight">
                      {alert.product?.name}
                    </div>
                    <div className="text-[10px] text-[var(--text-muted)] mt-0.5 uppercase">
                      {t("pantry.location")}: {alert.location?.name} | {t("pantry.batch")}: {alert.batch_code || "NONE"}
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <div className="font-bold text-xs uppercase">
                        {t("pantry.expiring")}
                      </div>
                      <div className="text-[10px] font-bold mt-0.5">
                        {alert.expiration_date}
                      </div>
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

        {/* Low-stock Shopping List Action Panel */}
        <div className="border border-[var(--border-subtle)] bg-[var(--surface-card)] p-6 flex flex-col justify-between min-h-[400px] rounded-lg shadow-sm">
          <div>
            <h2 className="font-heading text-2xl font-black border-b border-[var(--border-subtle)] pb-3 mb-4 uppercase tracking-wide text-[var(--text-main)]">
              {t("pantry.shoppingList")}
            </h2>
            <p className="text-xs text-[var(--text-muted)] uppercase leading-relaxed tracking-wide font-sans">
              {t("pantry.shoppingListDesc")}
            </p>

            <div className="mt-6 space-y-3">
              <div className="text-xs uppercase font-bold text-[var(--text-muted)]">
                {t("pantry.quotaViolations")}
              </div>
              {isLoadingMetrics ? (
                <div className="text-xs text-[var(--text-muted)]">{t("pantry.calculating")}</div>
              ) : (
                <div className="space-y-2 max-h-[160px] overflow-y-auto">
                  {lowStockItems.length === 0 ? (
                    <div className="text-xs text-[var(--text-muted)]">{t("pantry.allQuotasSatisfied")}</div>
                  ) : (
                    lowStockItems.map((item, idx) => (
                      <div key={idx} className="flex justify-between items-center text-xs border-b border-[var(--border-subtle)] pb-1.5">
                        <span className="font-bold uppercase truncate max-w-[150px] text-[var(--text-main)]">{item.product.name}</span>
                        <span className="text-[10px] text-[var(--text-muted)] font-mono">
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
              className="w-full py-6 text-xs font-black tracking-widest border-2 border-[var(--border-accent)] bg-[var(--surface-elevated)] text-[var(--primary-main)] hover:bg-[var(--primary-main)] hover:text-black cursor-pointer select-none transition-all flex items-center justify-center gap-2 rounded-lg"
            >
              {isExporting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  {t("pantry.exportingLogistics")}
                </>
              ) : exportSuccess ? (
                <>
                  <Check className="h-4 w-4 text-emerald-400" />
                  {t("pantry.listExported")}
                </>
              ) : (
                <>
                  <Send className="h-4 w-4" />
                  {t("pantry.exportList")}
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
