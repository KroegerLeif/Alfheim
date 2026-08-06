"use client";

import { useState, useEffect, useMemo } from "react";
import { ShoppingCart } from "lucide-react";
import { useTranslations } from "next-intl";
import { useActiveList } from "@/app/[locale]/providers";
import { ListSelector } from "@/features/shopping-lists/components/ListSelector";
import { ChecklistContainer } from "@/features/shopping-lists/components/ChecklistContainer";
import { AddManualItem } from "@/features/shopping-lists/components/AddManualItem";
import { QuickAddGrid } from "@/features/shopping-history/components/QuickAddGrid";
import { EinlagernModal } from "@/features/shopping-lists/components/EinlagernModal";
import { DashboardHeader } from "@/features/shopping-lists/components/DashboardHeader";
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
import { ApiError } from "@/lib/api";
import { cn } from "@/lib/utils";

/**
 * Main localized Shopping Dashboard aligned with FDD and SRP boundaries.
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

  // Queries
  const {
    data: listsData,
    isLoading: listsLoading,
    isError: listsError,
    error: listsErrObj,
    refetch: refetchLists,
  } = useShoppingLists();

  const lists = useMemo(() => listsData ?? [], [listsData]);

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
  const { data: householdsData } = useHouseholds();
  const households = useMemo(() => householdsData ?? [], [householdsData]);
  const [activeHouseholdId, setActiveHouseholdId] = useState<string | null>(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("loeger_os_active_household_id");
    }
    return null;
  });

  useEffect(() => {
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

  const items = listDetails?.items ?? [];
  const activeList = lists.find((l) => l.id === resolvedListId);

  const handleQuickAdd = (name: string, unit: string) => {
    if (!resolvedListId) return;
    addItem.mutate({ name, quantity: 1, unit });
  };

  const handleSyncToPantry = async () => {
    if (!resolvedListId) return;
    try {
      const response = await syncToPantry.mutateAsync({ householdId: activeHouseholdId ?? undefined });
      if (response.status === "partial_success" && (response.unrecognized_items ?? []).length > 0) {
        setUnrecognizedItems(response.unrecognized_items);
        setShowModal(true);
      }
    } catch (err) {
      console.error("Sync to Pantry failed:", err);
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
      (listsErrObj as ApiError | null)?.status === 401 ||
      (listsErrObj as ApiError | null)?.status === 403 ||
      (listsErrObj instanceof Error && listsErrObj.message.includes("401"));

    const handleLogin = () => {
      if (typeof window !== "undefined") {
        const keycloak = (window as Window & { __keycloak_instance__?: { login: () => void } }).__keycloak_instance__;
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
        <DashboardHeader
          activeList={activeList}
          username={user.username}
          households={households}
          checkedCount={items.filter((i) => i.is_completed).length}
          totalCount={items.length}
          onSync={handleSyncToPantry}
          onClearCompleted={handleClearCompleted}
          isSyncPending={syncToPantry.isPending}
        />

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
          {(!isMobile || mobileView === "list") && (
            <div className="glass-card rounded-2xl flex flex-col min-h-0 overflow-hidden">
              <ChecklistContainer listId={resolvedListId || ""} />
            </div>
          )}

          {(!isMobile || mobileView === "add") && (
            <div className="flex flex-col gap-3.5 min-h-0">
              <AddManualItem listId={resolvedListId || ""} />
              <QuickAddGrid onAdd={handleQuickAdd} disabled={!resolvedListId || addItem.isPending} />
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
