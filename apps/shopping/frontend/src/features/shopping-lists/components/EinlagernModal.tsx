"use client";

import { useState } from "react";
import { X, Save, AlertCircle, SkipForward } from "lucide-react";
import { useTranslations } from "next-intl";
import { UnrecognizedShoppingItem } from "../types";
import {
  useCreatePantryProduct,
  useDeleteShoppingItem,
  useSyncToPantry,
} from "../services/shoppingListService";
import { Specular } from "@/components/shared/Specular";
import { cn } from "@/lib/utils";

interface LocalStateItem extends UnrecognizedShoppingItem {
  resolved: "pending" | "saved" | "ignored";
  catalogName?: string;
}

interface EinlagernModalProps {
  listId: string;
  initialItems: UnrecognizedShoppingItem[];
  onClose: () => void;
}

/**
 * Scan & Sync checkout wizard modal for unknown grocery items.
 */
export function EinlagernModal({ listId, initialItems, onClose }: EinlagernModalProps) {
  const t = useTranslations("Modal");

  // Local State representing the items being resolved
  const [items, setItems] = useState<LocalStateItem[]>(
    initialItems.map((i) => ({ ...i, resolved: "pending" }))
  );

  const [savingId, setSavingId] = useState<string | null>(null);
  const [catalogInput, setCatalogInput] = useState("");

  // Mutations
  const createProduct = useCreatePantryProduct();
  const deleteItem = useDeleteShoppingItem(listId);
  const syncToPantry = useSyncToPantry(listId);

  const pending = items.filter((i) => i.resolved === "pending");
  const allDone = pending.length === 0;

  const startSave = (id: string, currentName: string) => {
    setSavingId(id);
    setCatalogInput(currentName);
  };

  const confirmSave = async (id: string, unit: string) => {
    if (!catalogInput.trim()) return;

    try {
      // Normalise unit for Pantry API expectations (piece, g, ml)
      let baseUnit = "piece";
      const u = unit.toLowerCase();
      if (u === "g" || u === "kg") baseUnit = "g";
      else if (u === "ml" || u === "l") baseUnit = "ml";

      // Register the product blueprint in the Pantry Catalog!
      await createProduct.mutateAsync({
        name: catalogInput.trim(),
        base_unit: baseUnit,
        minimum_stock: 0.0,
      });

      // Update local state resolution status
      setItems((prev) =>
        prev.map((i) =>
          i.shopping_item_id === id
            ? { ...i, resolved: "saved", catalogName: catalogInput.trim() }
            : i
        )
      );
      setSavingId(null);
    } catch (err) {
      console.error("Failed to register catalog item:", err);
    }
  };

  const ignore = (id: string) => {
    // Delete the item from the checklist optimistically
    deleteItem.mutate(id);

    // Update local state resolution status
    setItems((prev) =>
      prev.map((i) =>
        i.shopping_item_id === id ? { ...i, resolved: "ignored" } : i
      )
    );
  };

  const handleFinish = async () => {
    try {
      // Trigger checkout sync again in background
      await syncToPantry.mutateAsync();
      onClose();
    } catch {
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-md">
      <div className="relative max-w-[500px] w-full glass-modal rounded-2xl overflow-hidden border border-border/40 shadow-2xl">
        <Specular opacityClassName="via-white/50 dark:via-white/20" />

        {/* Caustic blue top line */}
        <div
          aria-hidden
          className="absolute top-0 left-0 right-0 h-[2.5px] 
                     bg-gradient-to-r from-transparent via-blue-500/50 via-cyan-400/80 via-blue-500/50 to-transparent 
                     rounded-t-2xl z-20"
        />

        <div className="p-6 md:p-8 space-y-6">
          {/* Header row */}
          <div className="flex justify-between items-start gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-1.5 font-mono text-[9px] font-bold text-cyan-600 dark:text-cyan-400 uppercase tracking-widest leading-none">
                <AlertCircle className="h-3 w-3 shrink-0" strokeWidth={2.5} />
                {t("scanTitle")}
              </div>
              <h2 className="font-heading text-xl font-black uppercase tracking-wide leading-none text-foreground whitespace-pre-line">
                {allDone
                  ? t("allDoneTitle")
                  : t("unresolvedTitle", { count: pending.length })}
              </h2>
            </div>

            <button
              onClick={onClose}
              className="w-8 h-8 rounded-lg flex items-center justify-center cursor-pointer 
                         glass-inset hover:glass-active text-muted-foreground hover:text-foreground shrink-0 transition-all duration-300"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Unresolved items listing */}
          {!allDone && (
            <div className="space-y-2 max-h-[260px] overflow-y-auto scrollbar-none pr-1">
              {items.map((item) => {
                const isCurrentSaving = savingId === item.shopping_item_id;

                return (
                  <div
                    key={item.shopping_item_id}
                    className={cn(
                      "rounded-xl p-4 transition-all border",
                      item.resolved === "pending"
                        ? "glass-inset border-border/20"
                        : "bg-white/2 dark:bg-white/[0.01] border-transparent opacity-40"
                    )}
                  >
                    <div className="flex justify-between items-center gap-3">
                      <div className="min-w-0">
                        <div className="font-heading text-sm font-bold uppercase tracking-wider text-foreground truncate">
                          {item.name}
                        </div>
                        <div className="font-mono text-[10px] text-muted-foreground/60 mt-0.5">
                          {item.quantity} {item.unit}
                          {item.resolved === "saved" && (
                            <span className="text-cyan-600 dark:text-cyan-400 font-bold ml-2">
                              {t("savedLabel", { catalogName: item.catalogName ?? "" })}
                            </span>
                          )}
                          {item.resolved === "ignored" && (
                            <span className="text-muted-foreground/40 font-bold ml-2">
                              {t("ignoredLabel")}
                            </span>
                          )}
                        </div>
                      </div>

                      {item.resolved === "pending" && !isCurrentSaving && (
                        <div className="flex gap-1.5 shrink-0 select-none">
                          <button
                            onClick={() => startSave(item.shopping_item_id, item.name)}
                            className="h-8 px-3 rounded-lg flex items-center justify-center gap-1 cursor-pointer
                                       glass-active font-heading text-[10px] font-black uppercase tracking-wider text-blue-500 dark:text-blue-400"
                          >
                            <Save className="h-3 w-3 shrink-0" strokeWidth={2.5} />
                            {t("catalogBtn")}
                          </button>
                          <button
                            onClick={() => ignore(item.shopping_item_id)}
                            className="h-8 px-3 rounded-lg flex items-center justify-center gap-1 cursor-pointer
                                       glass-inset font-heading text-[10px] font-black uppercase tracking-wider text-muted-foreground/50 hover:text-foreground"
                          >
                            <SkipForward className="h-3 w-3 shrink-0" strokeWidth={2.5} />
                            {t("ignoreBtn")}
                          </button>
                        </div>
                      )}
                    </div>

                    {/* Catalog Save Panel */}
                    {isCurrentSaving && (
                      <div className="mt-3.5 pt-3 border-t border-border/10 flex flex-col gap-2 select-none">
                        <label className="font-mono text-[8px] font-bold text-blue-500 uppercase tracking-widest leading-none mb-1">
                          {t("inputLabel")}
                        </label>
                        <div className="flex gap-2">
                          <input
                            value={catalogInput}
                            onChange={(e) => setCatalogInput(e.target.value)}
                            onKeyDown={(e) =>
                              e.key === "Enter" && confirmSave(item.shopping_item_id, item.unit)
                            }
                            autoFocus
                            disabled={createProduct.isPending}
                            className="flex-1 h-9 px-3 rounded-lg bg-white/5 border border-border/30 outline-none
                                       font-heading text-sm font-semibold tracking-wide text-foreground min-w-0"
                          />
                          <button
                            onClick={() => confirmSave(item.shopping_item_id, item.unit)}
                            disabled={createProduct.isPending || !catalogInput.trim()}
                            className="h-9 px-4 rounded-lg flex items-center justify-center font-heading text-xs font-black uppercase tracking-wider 
                                       text-white bg-gradient-to-br from-blue-400 to-blue-800 disabled:opacity-40 shrink-0 border border-blue-900 shadow-sm cursor-pointer"
                          >
                            {createProduct.isPending ? "..." : t("saveBtn")}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* All Done Finished Box */}
          {allDone && (
            <div className="p-4 rounded-xl glass-active text-center shrink-0 select-none">
              <span className="font-mono text-[10px] font-bold uppercase tracking-wider text-cyan-600 dark:text-cyan-400 leading-none">
                {t("summaryText", {
                  saved: items.filter((i) => i.resolved === "saved").length,
                  ignored: items.filter((i) => i.resolved === "ignored").length,
                })}
              </span>
            </div>
          )}

          {/* Dismiss button */}
          <button
            onClick={allDone ? handleFinish : onClose}
            className="w-full h-11 rounded-xl flex items-center justify-center cursor-pointer 
                       glass-inset hover:glass-active text-muted-foreground/60 hover:text-foreground
                       font-heading text-sm font-bold uppercase tracking-wider shrink-0 transition-colors select-none"
          >
            {allDone ? t("doneBtn") : t("laterBtn")}
          </button>
        </div>
      </div>
    </div>
  );
}
