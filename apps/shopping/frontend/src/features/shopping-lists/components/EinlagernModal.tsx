"use client";

import { useState, useMemo } from "react";
import { X, Building2, ChevronDown, AlertCircle } from "lucide-react";
import { useTranslations } from "next-intl";
import type { UnrecognizedShoppingItem } from "../types";
import {
  useCreatePantryProduct,
  useDeleteShoppingItem,
  useSyncToPantry,
  useHouseholds,
} from "../services/shoppingListService";
import { EinlagernItemRow, LocalStateItem } from "./EinlagernItemRow";

interface EinlagernModalProps {
  listId: string;
  initialItems: UnrecognizedShoppingItem[];
  onClose: () => void;
}

/**
 * Scan & Sync checkout wizard modal supporting multi-household target selection
 * and item-level editing, skipping, deleting, or catalog registering actions.
 */
export function EinlagernModal({ listId, initialItems = [], onClose }: EinlagernModalProps) {
  const t = useTranslations("Modal");

  // Query available households
  const { data: householdsData } = useHouseholds();
  const households = useMemo(() => householdsData ?? [], [householdsData]);
  const [selectedHouseholdId, setSelectedHouseholdId] = useState<string>("");

  const resolvedHouseholdId = useMemo(() => {
    if (selectedHouseholdId) return selectedHouseholdId;
    if (households.length === 0) return "";
    const activeHhId = typeof window !== "undefined" ? localStorage.getItem("alfheim_active_household_id") : null;
    const matched = households.find((h) => h.id === activeHhId);
    return matched ? matched.id : households[0].id;
  }, [selectedHouseholdId, households]);

  // Local State representing items being resolved/individualized
  const [items, setItems] = useState<LocalStateItem[]>(() =>
    (initialItems ?? []).map((i) => ({
      ...i,
      name: i.name,
      quantity: i.quantity,
      unit: i.unit,
      resolved: "pending",
    }))
  );

  const createProduct = useCreatePantryProduct();
  const deleteItem = useDeleteShoppingItem(listId);
  const syncToPantry = useSyncToPantry(listId);

  const pending = items.filter((i) => i.resolved === "pending");
  const allDone = pending.length === 0;

  const handleEditItem = (id: string, name: string, quantity: number, unit: string) => {
    setItems((prev) =>
      prev.map((i) =>
        i.shopping_item_id === id
          ? { ...i, name, quantity, unit }
          : i
      )
    );
  };

  const handleSaveCatalog = async (id: string, catalogName: string, unit: string) => {
    let baseUnit = "piece";
    const u = unit.toLowerCase();
    if (u === "g" || u === "kg") baseUnit = "g";
    else if (u === "ml" || u === "l") baseUnit = "ml";

    await createProduct.mutateAsync({
      name: catalogName,
      base_unit: baseUnit,
      minimum_stock: 0.0,
      householdId: resolvedHouseholdId,
    });

    setItems((prev) =>
      prev.map((i) =>
        i.shopping_item_id === id
          ? { ...i, resolved: "saved", catalogName }
          : i
      )
    );
  };

  const handleSkipItem = (id: string) => {
    setItems((prev) =>
      prev.map((i) =>
        i.shopping_item_id === id ? { ...i, resolved: "skipped" } : i
      )
    );
  };

  const handleRemoveItem = (id: string) => {
    deleteItem.mutate(id);
    setItems((prev) =>
      prev.map((i) =>
        i.shopping_item_id === id ? { ...i, resolved: "ignored" } : i
      )
    );
  };

  const handleFinish = async () => {
    try {
      await syncToPantry.mutateAsync({ householdId: resolvedHouseholdId });
      onClose();
    } catch {
      onClose();
    }
  };

  const selectedHousehold = households.find((h) => h.id === resolvedHouseholdId) || households[0];

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative max-w-[540px] w-full bg-[var(--surface-card)] rounded-2xl overflow-hidden border border-[var(--border-subtle)] shadow-2xl">
        <div className="p-6 md:p-8 space-y-5">
          {/* Header row */}
          <div className="flex justify-between items-start gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-1.5 font-mono text-[10px] font-bold text-[var(--accent-cyan)] uppercase tracking-widest leading-none">
                <AlertCircle className="h-3.5 w-3.5 shrink-0" strokeWidth={2.5} />
                {t("scanTitle")}
              </div>
              <h2 className="font-heading text-xl font-black uppercase tracking-wide leading-none text-[var(--text-main)] whitespace-pre-line">
                {allDone ? t("allDoneTitle") : t("unresolvedTitle", { count: pending.length })}
              </h2>
            </div>

            <button
              onClick={onClose}
              className="w-8 h-8 rounded-lg flex items-center justify-center cursor-pointer bg-[var(--surface-canvas)] hover:bg-[var(--surface-elevated)] border border-[var(--border-subtle)] text-[var(--text-muted)] hover:text-[var(--text-main)] shrink-0 transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Household Selector */}
          <div className="p-3 rounded-xl bg-[var(--surface-elevated)] border border-[var(--border-subtle)] flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-xs font-heading font-extrabold uppercase text-[var(--text-main)]">
              <Building2 className="h-4 w-4 text-[var(--primary-main)] shrink-0" />
              <span>{t("targetHousehold")}</span>
            </div>

            {households.length > 1 ? (
              <div className="relative">
                <select
                  value={resolvedHouseholdId}
                  onChange={(e) => setSelectedHouseholdId(e.target.value)}
                  className="appearance-none bg-[var(--surface-card)] border border-[var(--border-subtle)] rounded-lg px-3 py-1.5 pr-8 text-xs font-mono font-bold text-[var(--text-main)] outline-none cursor-pointer"
                >
                  {households.map((hh) => (
                    <option key={hh.id} value={hh.id}>
                      {hh.name} {hh.is_default ? t("defaultTag") : ""}
                    </option>
                  ))}
                </select>
                <ChevronDown className="h-3.5 w-3.5 text-[var(--text-muted)] pointer-events-none absolute right-2.5 top-2.5" />
              </div>
            ) : (
              <span className="font-mono text-xs font-bold text-[var(--primary-main)] px-2 py-1 rounded-md bg-[var(--primary-main)]/10 border border-[var(--primary-main)]/20">
                {selectedHousehold?.name || t("defaultTag")}
              </span>
            )}
          </div>

          {/* Unresolved / Batch Items List */}
          {!allDone && (
            <div className="space-y-2.5 max-h-[280px] overflow-y-auto scrollbar-none pr-1">
              {items.map((item) => (
                <EinlagernItemRow
                  key={item.shopping_item_id}
                  item={item}
                  onEdit={(name, qty, unit) => handleEditItem(item.shopping_item_id, name, qty, unit)}
                  onSaveCatalog={(catalogName, unit) => handleSaveCatalog(item.shopping_item_id, catalogName, unit)}
                  onSkip={() => handleSkipItem(item.shopping_item_id)}
                  onRemove={() => handleRemoveItem(item.shopping_item_id)}
                  isCreateProductPending={createProduct.isPending}
                />
              ))}
            </div>
          )}

          {allDone && (
            <div className="p-4 rounded-xl bg-[var(--primary-main)]/10 border border-[var(--primary-main)]/30 text-center shrink-0 select-none">
              <span className="font-mono text-[11px] font-bold uppercase tracking-wider text-[var(--primary-main)] leading-none">
                {t("summaryText", {
                  saved: items.filter((i) => i.resolved === "saved").length,
                  ignored: items.filter((i) => i.resolved === "ignored" || i.resolved === "skipped").length,
                })}
              </span>
            </div>
          )}

          <button
            onClick={allDone ? handleFinish : onClose}
            className="w-full h-11 rounded-xl flex items-center justify-center cursor-pointer bg-[var(--surface-elevated)] hover:bg-[var(--primary-main)] text-[var(--text-main)] hover:text-slate-950 font-heading text-sm font-bold uppercase tracking-wider shrink-0 transition-colors select-none"
          >
            {allDone ? t("doneBtn") : t("laterBtn")}
          </button>
        </div>
      </div>
    </div>
  );
}
