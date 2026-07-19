"use client";

import { useState, useEffect } from "react";
import { ShoppingCart, Archive, Sparkles, Package, Menu } from "lucide-react";
import { useTranslations } from "next-intl";
import { useSidebar } from "./providers";
import { ListSelector } from "@/features/shopping-lists/components/ListSelector";
import { ChecklistContainer } from "@/features/shopping-lists/components/ChecklistContainer";
import { AddManualItem } from "@/features/shopping-lists/components/AddManualItem";
import { QuickAddGrid } from "@/features/shopping-history/components/QuickAddGrid";
import { EinlagernModal } from "@/features/shopping-lists/components/EinlagernModal";
import { ThemeToggle } from "@/components/shared/ThemeToggle";
import { Specular } from "@/components/shared/Specular";
import { PantryBadge } from "@/components/shared/PantryBadge";
import {
  useShoppingLists,
  useShoppingListDetails,
  useAddShoppingItem,
  useSyncToPantry,
} from "@/features/shopping-lists/services/shoppingListService";
import { UnrecognizedShoppingItem } from "@/features/shopping-lists/types";
import { cn } from "@/lib/utils";

/**
 * Main localized Shopping Dashboard implementing tablet-first split views and sync checkout processes.
 */
export default function ShoppingDashboard() {
  const t = useTranslations("Checklist");
  const navT = useTranslations("Navigation");
  const { isSidebarOpen, setIsSidebarOpen } = useSidebar();

  // State
  const [activeListId, setActiveListId] = useState<string | null>(null);
  const [isMobile, setIsMobile] = useState(false);
  const [mobileView, setMobileView] = useState<"list" | "add">("list");
  const [unrecognizedItems, setUnrecognizedItems] = useState<UnrecognizedShoppingItem[]>([]);
  const [showModal, setShowModal] = useState(false);

  // Queries
  const { data: lists = [], isLoading: listsLoading } = useShoppingLists();
  const { data: listDetails } = useShoppingListDetails(activeListId || "");

  // Mutations
  const addItem = useAddShoppingItem(activeListId || "");
  const syncToPantry = useSyncToPantry(activeListId || "");

  // Detect mobile viewport size changes
  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // Auto-select first list when data loads
  useEffect(() => {
    if (lists.length > 0 && !activeListId) {
      setActiveListId(lists[0].id);
    }
  }, [lists, activeListId]);

  // Compute checklist progress metrics
  const items = listDetails?.items || [];
  const total = items.length;
  const checked = items.filter((i) => i.is_completed).length;
  const progress = total > 0 ? checked / total : 0;
  const circumference = 2 * Math.PI * 15; // r=15

  const handleQuickAdd = (name: string, unit: string) => {
    if (!activeListId) return;
    addItem.mutate({
      name,
      quantity: 1,
      unit,
    });
  };

  const handleSyncToPantry = async () => {
    if (!activeListId) return;
    try {
      const response = await syncToPantry.mutateAsync();
      
      if (response.status === "partial_success" && response.unrecognized_items.length > 0) {
        setUnrecognizedItems(response.unrecognized_items);
        setShowModal(true);
      }
    } catch (err) {
      console.error("Sync to Pantry failed:", err);
    }
  };

  if (listsLoading) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8 gap-4 animate-pulse">
        <div className="h-10 w-10 bg-white/5 rounded-xl" />
        <div className="h-4 w-32 bg-white/5 rounded-md" />
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col h-screen overflow-hidden bg-background font-body relative">
      {/* Background radial glows and SVG noise filter (Aesthetic Depth) */}
      <div aria-hidden className="absolute inset-0 pointer-events-none overflow-hidden z-0">
        <div className="absolute top-[-25%] left-[-12%] w-[65vw] h-[65vw] rounded-full bg-gradient-to-br from-blue-600/10 to-blue-800/0 dark:from-blue-600/15 dark:to-blue-800/0 blur-[72px]" />
        <div className="absolute bottom-[-18%] right-[-8%] w-[52vw] h-[52vw] rounded-full bg-gradient-to-br from-cyan-400/5 to-blue-500/0 dark:from-cyan-400/8 dark:to-blue-500/0 blur-[80px]" />
        <div className="absolute top-[38%] left-[42%] w-[36vw] h-[36vw] rounded-full bg-gradient-to-br from-purple-600/5 to-transparent dark:from-purple-600/5 dark:to-transparent blur-[80px]" />
        <svg className="absolute inset-0 w-full h-full opacity-[0.015] dark:opacity-[0.022]">
          <filter id="grain">
            <feTurbulence type="fractalNoise" baseFrequency="0.7" numOctaves="3" stitchTiles="stitch" />
          </filter>
          <rect width="100%" height="100%" filter="url(#grain)" />
        </svg>
      </div>

      {/* Foreground Shell Content */}
      <div className="relative z-10 flex flex-col h-full p-4 md:p-5 gap-3.5 min-h-0 select-none">
        
        {/* Top bar */}
        <header className="flex items-center justify-between shrink-0 select-none">
          <div className="flex items-center gap-3">
            {!isSidebarOpen && (
              <button
                onClick={() => setIsSidebarOpen(true)}
                className="w-10 h-10 rounded-[13px] flex items-center justify-center glass-inset hover:bg-muted text-muted-foreground hover:text-foreground cursor-pointer shrink-0 transition-colors duration-200"
                aria-label="Expand Sidebar"
                title="Expand Sidebar"
              >
                <Menu className="h-5 w-5" />
              </button>
            )}
            <div className="w-10 h-10 rounded-[13px] flex items-center justify-center bg-gradient-to-br from-blue-400 via-blue-500 to-blue-800 border-t border-blue-300/50 border-l border-blue-300/30 border-r border-blue-900/40 border-b border-blue-950/50 shadow-lg shadow-blue-500/30">
              <ShoppingCart className="h-5.5 w-5.5 text-white" strokeWidth={2} />
            </div>
            <div className="flex flex-col gap-0.5">
              <span className="font-mono text-[9px] font-extrabold uppercase tracking-widest text-blue-500 dark:text-blue-400 leading-none">
                {navT("title")}
              </span>
              <span className="font-heading text-lg font-black uppercase tracking-wide leading-none text-foreground">
                Shopping
              </span>
            </div>
          </div>

          {/* Progress Indicators & Theme switcher */}
          <div className="flex items-center gap-3 select-none">
            <div className="hidden sm:flex flex-col items-end gap-0.5">
              <span className="font-mono text-[9px] text-muted-foreground/45 uppercase tracking-widest leading-none">
                {t("completed")}
              </span>
              <span className="font-mono text-sm font-bold text-foreground leading-none">
                <span className="text-cyan-600 dark:text-cyan-400">{checked}</span>
                <span className="text-muted-foreground/30 font-medium"> / </span>
                {total}
              </span>
            </div>

            {/* Circular Progress Ring */}
            <div className="w-[42px] h-[42px] rounded-[13px] flex items-center justify-center glass-inset relative shrink-0">
              <Specular opacityClassName="via-white/35 dark:via-white/10" />
              <svg width="26" height="26" viewBox="0 0 36 36" className="transform -rotate-95">
                <circle cx="18" cy="18" r="15" fill="none" className="stroke-slate-200 dark:stroke-white/5" strokeWidth="3" />
                <circle
                  cx="18"
                  cy="18"
                  r="15"
                  fill="none"
                  stroke="url(#progressGradient)"
                  strokeWidth="3"
                  strokeLinecap="round"
                  strokeDasharray={`${progress * circumference} ${circumference}`}
                  className="transition-all duration-500 ease-out"
                />
                <defs>
                  <linearGradient id="progressGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" stopColor="#0052FF" />
                    <stop offset="100%" stopColor="#32CFFF" />
                  </linearGradient>
                </defs>
              </svg>
            </div>

            {/* Fluid Theme Toggle */}
            <ThemeToggle />
          </div>
        </header>

        {/* Dynamic horizontal lists select switcher */}
        <ListSelector activeListId={activeListId} onSelect={setActiveListId} />

        {/* Mobile View Toggle Switchers */}
        {isMobile && (
          <div className="flex gap-2 shrink-0 select-none">
            {(["list", "add"] as const).map((view) => (
              <button
                key={view}
                onClick={() => setMobileView(view)}
                className={cn(
                  "flex-1 h-9 rounded-xl font-heading text-xs font-black uppercase tracking-wider transition-all duration-300",
                  mobileView === view ? "glass-active text-foreground" : "glass-inset text-muted-foreground"
                )}
              >
                {view === "list" ? t("title") : t("einlagernBtn")}
              </button>
            ))}
          </div>
        )}

        {/* Main Content Layout Panels */}
        <div className="grid md:grid-cols-[2fr_1fr] gap-3.5 flex-1 min-h-0">
          
          {/* Left panel: Checklist list scrolling container */}
          {(!isMobile || mobileView === "list") && (
            <div className="glass-card rounded-2xl flex flex-col min-h-0 overflow-hidden">
              <ChecklistContainer listId={activeListId || ""} />
              
              {/* Einkauf Einlagern Sync CTA Button */}
              {listDetails && listDetails.items.some((i) => i.is_completed) && (
                <div className="p-4 border-t border-border/40 shrink-0 select-none">
                  <button
                    onClick={handleSyncToPantry}
                    disabled={syncToPantry.isPending}
                    className="w-full h-11 rounded-xl flex items-center justify-center gap-2 cursor-pointer
                               font-heading text-sm font-black uppercase tracking-wider transition-all duration-300
                               text-white bg-gradient-to-br from-blue-400 via-blue-500 to-blue-800 hover:scale-[1.005] hover:shadow-lg hover:shadow-blue-500/25
                               border-t border-blue-300/40 border-l border-blue-300/20 border-r border-blue-900/30 border-b border-blue-950/40 shrink-0"
                  >
                    <Archive className="h-4 w-4 shrink-0" />
                    {t("einlagernBtn")}
                    <Sparkles className="h-3.5 w-3.5 text-blue-200/60 shrink-0" />
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Right panel: Sticky action inputs & Quick Add selection grid */}
          {(!isMobile || mobileView === "add") && (
            <div className="flex flex-col gap-3.5 min-h-0">
              
              {/* Stepper Manual Add form */}
              <AddManualItem listId={activeListId || ""} />
              
              {/* Quick Tile Grid aggregation */}
              <QuickAddGrid onAdd={handleQuickAdd} disabled={!activeListId || addItem.isPending} />

              {/* Pantry Legend description box */}
              <div className="glass-inset rounded-xl p-3 flex items-center gap-3 shrink-0 select-none">
                <PantryBadge />
                <p className="font-body text-[10px] text-muted-foreground/60 leading-tight">
                  {t("pantryLegend")}
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Checkout resolution modal popup */}
      {showModal && activeListId && (
        <EinlagernModal
          listId={activeListId}
          initialItems={unrecognizedItems}
          onClose={() => {
            setShowModal(false);
            setUnrecognizedItems([]);
          }}
        />
      )}
    </div>
  );
}
