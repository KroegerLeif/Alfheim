"use client";

import { useState, useEffect, useMemo } from "react";
import {
  ShoppingCart,
  Archive,
  Sparkles,
  Home,
  User,
  Share2,
  Printer,
  Trash2,
  CheckCircle2,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { useSidebar, useActiveList } from "@/app/[locale]/providers";
import { ListSelector } from "@/features/shopping-lists/components/ListSelector";
import { ChecklistContainer } from "@/features/shopping-lists/components/ChecklistContainer";
import { AddManualItem } from "@/features/shopping-lists/components/AddManualItem";
import { QuickAddGrid } from "@/features/shopping-history/components/QuickAddGrid";
import { EinlagernModal } from "@/features/shopping-lists/components/EinlagernModal";
import { Specular } from "@loeger-os/shared";
import { PantryBadge } from "@/components/shared/PantryBadge";
import {
  useShoppingLists,
  useShoppingListDetails,
  useAddShoppingItem,
  useSyncToPantry,
  useDeleteShoppingItem,
  useHouseholds,
} from "@/features/shopping-lists/services/shoppingListService";
import { UnrecognizedShoppingItem } from "@/features/shopping-lists/types";
import { useKeycloakUser } from "@/lib/useKeycloakUser";
import { cn } from "@/lib/utils";

/**
 * Main localized Shopping Dashboard aligned with stitch_loeger_os & Figma specifications.
 */
export default function ShoppingDashboard() {
  const t = useTranslations("Checklist");
  const navT = useTranslations("Navigation");
  const errT = useTranslations("Error");
  const { activeListId, setActiveListId } = useActiveList();
  const user = useKeycloakUser();

  // Mobile state & modals
  const [isMobile, setIsMobile] = useState(false);
  const [mobileView, setMobileView] = useState<"list" | "add">("list");
  const [unrecognizedItems, setUnrecognizedItems] = useState<UnrecognizedShoppingItem[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [copiedNotification, setCopiedNotification] = useState(false);

  // Queries
  const {
    data: listsData,
    isLoading: listsLoading,
    isError: listsError,
    error: listsErrObj,
    refetch: refetchLists,
  } = useShoppingLists();

  const lists = listsData || [];

  // Compute fallback default list ID (Personal -> Household -> First)
  const defaultListId = useMemo(() => {
    if (lists.length === 0) return null;
    const personal = lists.find((l) => l.is_personal);
    if (personal) return personal.id;
    const household = lists.find((l) => l.is_default);
    if (household) return household.id;
    return lists[0].id;
  }, [lists]);

  // Keep activeListId in sync
  const resolvedListId = activeListId ?? defaultListId;

  useEffect(() => {
    if (!activeListId && defaultListId) {
      setActiveListId(defaultListId);
    }
  }, [activeListId, defaultListId, setActiveListId]);

  const { data: listDetails } = useShoppingListDetails(resolvedListId || "");
  const addItem = useAddShoppingItem(resolvedListId || "");
  const syncToPantry = useSyncToPantry(resolvedListId || "");
  const deleteItem = useDeleteShoppingItem(resolvedListId || "");

  // Viewport detection
  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // Query households and track active household ID
  const { data: households = [] } = useHouseholds();
  const [activeHouseholdId, setActiveHouseholdId] = useState<string | null>(null);

  useEffect(() => {
    setActiveHouseholdId(localStorage.getItem("loeger_os_active_household_id"));
    const handleLocalChange = () => {
      setActiveHouseholdId(localStorage.getItem("loeger_os_active_household_id"));
    };
    window.addEventListener("storage", handleLocalChange);
    window.addEventListener("storage-household-changed", handleLocalChange);
    return () => {
      window.removeEventListener("storage", handleLocalChange);
      window.removeEventListener("storage-household-changed", handleLocalChange);
    };
  }, []);

  // Metrics calculation
  const items = listDetails?.items || [];
  const total = items.length;
  const checked = items.filter((i) => i.is_completed).length;
  const progress = total > 0 ? Math.min(Math.max(checked / total, 0), 1) : 0;
  const percentage = total > 0 ? Math.round((checked / total) * 100) : 0;
  const circumference = 2 * Math.PI * 15; // r=15
  const strokeDash = total > 0 ? `${progress * circumference} ${circumference}` : `0 ${circumference}`;

  // Resolved active list and household display names
  const activeList = lists.find((l) => l.id === resolvedListId);

  const activeHouseholdName = useMemo(() => {
    if (!activeHouseholdId || households.length === 0) return "";
    const activeHh = households.find((h) => h.id === activeHouseholdId);
    return activeHh ? activeHh.name : "";
  }, [activeHouseholdId, households]);

  const isPersonalList = (l: { is_personal?: boolean; name: string }) =>
    l.is_personal ||
    l.name.endsWith(" - Liste") ||
    l.name.endsWith("'s List") ||
    l.name.startsWith("Lista ");

  const activeListName = useMemo(() => {
    if (!activeList) return t("title");
    if (isPersonalList(activeList)) {
      return user.username && user.username !== "User"
        ? navT("personalList", { username: user.username })
        : navT("personal_list_fallback");
    }
    if (activeList.is_default) {
      const hh = households.find((h) => h.id === activeList.home_id);
      return hh ? hh.name : navT("household_list_fallback");
    }
    return activeList.name;
  }, [activeList, user.username, households, navT, t]);

  const displayListName = activeListName;

  const handleQuickAdd = (name: string, unit: string) => {
    if (!resolvedListId) return;
    addItem.mutate({
      name,
      quantity: 1,
      unit,
    });
  };

  const handleSyncToPantry = async () => {
    if (!resolvedListId) return;
    try {
      const response = await syncToPantry.mutateAsync({ householdId: activeHouseholdId ?? undefined });
      if (response.status === "partial_success" && response.unrecognized_items.length > 0) {
        setUnrecognizedItems(response.unrecognized_items);
        setShowModal(true);
      }
    } catch (err) {
      console.error("Sync to Pantry failed:", err);
    }
  };

  const handleShare = () => {
    if (typeof window !== "undefined") {
      navigator.clipboard.writeText(window.location.href);
      setCopiedNotification(true);
      setTimeout(() => setCopiedNotification(false), 2500);
    }
  };

  const handlePrint = () => {
    if (typeof window !== "undefined") {
      window.print();
    }
  };

  const handleClearCompleted = () => {
    const completed = items.filter((i) => i.is_completed);
    if (completed.length === 0) return;
    if (confirm(t("deleteCompletedConfirm", { count: completed.length }))) {
      completed.forEach((i) => deleteItem.mutate(i.id));
    }
  };

  if (listsLoading) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8 gap-4 animate-pulse">
        <div className="h-10 w-10 bg-muted/40 rounded-xl" />
        <div className="h-4 w-32 bg-muted/30 rounded-md" />
      </div>
    );
  }

  if (listsError) {
    const isAuthError =
      (listsErrObj as any)?.status === 401 ||
      (listsErrObj as any)?.status === 403 ||
      (listsErrObj instanceof Error && listsErrObj.message.includes("401"));

    const handleLogin = () => {
      if (typeof window !== "undefined") {
        const keycloak = (window as any).__keycloak_instance__;
        if (keycloak && typeof keycloak.login === "function") {
          keycloak.login();
          return;
        }
        window.location.reload();
      }
    };

    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8 gap-4 text-center">
        <div className="glass-card max-w-md p-6 rounded-2xl border border-red-500/20 space-y-4">
          <div className="h-12 w-12 rounded-xl bg-red-500/10 text-red-400 flex items-center justify-center mx-auto">
            <ShoppingCart className="h-6 w-6" />
          </div>
          <h2 className="text-lg font-bold text-foreground uppercase tracking-wide">
            {isAuthError ? errT("sessionExpired") : errT("fetchFailed")}
          </h2>
          <p className="text-xs text-muted-foreground">
            {isAuthError
              ? errT("sessionExpiredDesc")
              : listsErrObj instanceof Error
              ? listsErrObj.message
              : errT("fetchFailedDesc")}
          </p>
          <div className="flex gap-2 justify-center">
            {isAuthError ? (
              <button
                onClick={handleLogin}
                className="px-4 py-2 rounded-xl bg-primary text-primary-foreground font-heading text-xs font-extrabold uppercase tracking-wider transition-colors cursor-pointer"
              >
                {errT("logIn")}
              </button>
            ) : (
              <button
                onClick={() => refetchLists()}
                className="px-4 py-2 rounded-xl bg-primary text-primary-foreground font-heading text-xs font-extrabold uppercase tracking-wider transition-colors cursor-pointer"
              >
                {errT("retry")}
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden font-sans relative select-none">
      {/* Dynamic Background Depth Ambient Glows */}
      <div aria-hidden className="absolute inset-0 pointer-events-none overflow-hidden z-0">
        <div className="absolute top-[-20%] left-[-10%] w-[55vw] h-[55vw] rounded-full bg-gradient-to-br from-blue-500/10 to-transparent blur-[90px]" />
        <div className="absolute bottom-[-15%] right-[-5%] w-[45vw] h-[45vw] rounded-full bg-gradient-to-br from-cyan-400/8 to-transparent blur-[90px]" />
      </div>

      {/* Main Canvas Container */}
      <div className="relative z-10 flex flex-col h-full gap-3.5 min-h-0">
        
        {/* Top Summary Header Banner Card */}
        <div className="glass-card rounded-2xl p-4 md:p-5 relative overflow-hidden shrink-0">
          <Specular opacityClassName="via-white/30 dark:via-white/10" />

          <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            {/* Active List Meta */}
            <div className="flex items-center gap-3.5">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-blue-500 via-blue-600 to-indigo-700 flex items-center justify-center text-white shadow-lg shadow-blue-500/25 shrink-0 border border-blue-400/30">
                {activeList?.is_default ? (
                  <Home className="h-6 w-6" />
                ) : activeList?.is_personal ? (
                  <User className="h-6 w-6" />
                ) : (
                  <ShoppingCart className="h-6 w-6" />
                )}
              </div>

              <div className="flex flex-col gap-1">
                <div className="flex items-center gap-2">
                  <h1 className="font-heading text-xl md:text-2xl font-black uppercase tracking-wide leading-none text-foreground">
                    {displayListName}
                  </h1>

                  <span className="font-mono text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-500 dark:text-blue-400 border border-blue-500/20 uppercase">
                    {activeList?.is_default || activeList?.is_personal
                      ? t("systemProtected")
                      : t("customList")}
                  </span>
                </div>

                <span className="font-mono text-xs text-muted-foreground/70">
                  {checked} {t("completed")} · {total - checked} {t("open")}
                </span>
              </div>
            </div>

            {/* Circular Progress & Action Toolbar */}
            <div className="flex items-center gap-3 w-full md:w-auto justify-between md:justify-end">
              {/* Circular Progress Ring */}
              <div className="flex items-center gap-2.5 glass-inset px-3 py-1.5 rounded-xl shrink-0">
                <div className="w-9 h-9 rounded-lg flex items-center justify-center relative shrink-0">
                  <svg width="28" height="28" viewBox="0 0 36 36" className="transform -rotate-90">
                    <circle cx="18" cy="18" r="15" fill="none" className="stroke-border/40" strokeWidth="3" />
                    <circle
                      cx="18"
                      cy="18"
                      r="15"
                      fill="none"
                      stroke="url(#canvasProgressGrad)"
                      strokeWidth="3.5"
                      strokeLinecap="round"
                      strokeDasharray={strokeDash}
                      className="transition-all duration-500 ease-out"
                    />
                    <defs>
                      <linearGradient id="canvasProgressGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                        <stop offset="0%" stopColor="#3b82f6" />
                        <stop offset="100%" stopColor="#06b6d4" />
                      </linearGradient>
                    </defs>
                  </svg>
                </div>
                <div className="flex flex-col leading-none">
                  <span className="font-mono text-xs font-black text-foreground">
                    {percentage}%
                  </span>
                  <span className="text-[9px] font-mono text-muted-foreground/50 uppercase">
                    {t("progress")}
                  </span>
                </div>
              </div>

              {/* Action Buttons: Share, Print, Clear Completed */}
              <div className="flex items-center gap-1.5">
                <button
                  onClick={handleShare}
                  className="p-2 rounded-xl glass-inset hover:glass-active text-muted-foreground hover:text-foreground cursor-pointer transition-all"
                  title={t("share")}
                >
                  <Share2 className="h-4 w-4" />
                </button>

                <button
                  onClick={handlePrint}
                  className="p-2 rounded-xl glass-inset hover:glass-active text-muted-foreground hover:text-foreground cursor-pointer transition-all"
                  title={t("print")}
                >
                  <Printer className="h-4 w-4" />
                </button>

                {checked > 0 && (
                  <button
                    onClick={handleClearCompleted}
                    className="p-2 rounded-xl glass-inset hover:bg-red-500/10 text-muted-foreground hover:text-red-400 cursor-pointer transition-all"
                    title={t("clearCompleted")}
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                )}

                {/* Primary Action Button: Store Einkauf */}
                {items.some((i) => i.is_completed) && (
                  <button
                    onClick={handleSyncToPantry}
                    disabled={syncToPantry.isPending}
                    className="h-9 px-3.5 rounded-xl flex items-center gap-2 font-heading text-xs font-black uppercase tracking-wider text-white bg-gradient-to-br from-blue-500 to-cyan-500 hover:scale-[1.02] shadow-md shadow-blue-500/20 cursor-pointer transition-all shrink-0"
                  >
                    <Archive className="h-3.5 w-3.5" />
                    <span className="hidden sm:inline">{t("einlagernBtn")}</span>
                  </button>
                )}
              </div>
            </div>
          </div>

          {copiedNotification && (
            <div className="mt-2 text-center text-xs font-mono text-emerald-500 font-bold animate-in fade-in">
              ✓ {t("linkCopied")}
            </div>
          )}
        </div>

        {/* Dynamic horizontal lists select switcher */}
        <ListSelector activeListId={resolvedListId} onSelect={setActiveListId} />

        {/* Mobile View Switcher Tabs */}
        {isMobile && (
          <div className="flex gap-2 shrink-0 select-none">
            {(["list", "add"] as const).map((view) => (
              <button
                key={view}
                onClick={() => setMobileView(view)}
                className={cn(
                  "flex-1 h-9 rounded-xl font-heading text-xs font-black uppercase tracking-wider transition-all duration-200",
                  mobileView === view ? "glass-active text-foreground" : "glass-inset text-muted-foreground"
                )}
              >
                {view === "list" ? t("title") : navT("newList")}
              </button>
            ))}
          </div>
        )}

        {/* Main Content Layout Grid Canvas */}
        <div className="grid md:grid-cols-[2fr_1.1fr] gap-3.5 flex-1 min-h-0">
          
          {/* Left panel: Checklist list scrolling container */}
          {(!isMobile || mobileView === "list") && (
            <div className="glass-card rounded-2xl flex flex-col min-h-0 overflow-hidden">
              <ChecklistContainer listId={resolvedListId || ""} />
            </div>
          )}

          {/* Right panel: Quick Add card, Frequently Bought grid, Pantry legend */}
          {(!isMobile || mobileView === "add") && (
            <div className="flex flex-col gap-3.5 min-h-0">
              {/* Stepper Manual Add form */}
              <AddManualItem listId={resolvedListId || ""} />
              
              {/* Frequently Bought Quick Add selection grid */}
              <QuickAddGrid onAdd={handleQuickAdd} disabled={!resolvedListId || addItem.isPending} />

              {/* Pantry Legend description box */}
              <div className="glass-inset rounded-xl p-3 flex items-center gap-3 shrink-0 select-none">
                <PantryBadge />
                <p className="font-sans text-[11px] text-muted-foreground/70 leading-tight">
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
