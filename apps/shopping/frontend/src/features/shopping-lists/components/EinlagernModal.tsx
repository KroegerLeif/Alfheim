"use client";

import { useState, useEffect } from "react";
import {
  X,
  Save,
  AlertCircle,
  SkipForward,
  Edit2,
  Trash2,
  Check,
  Building2,
  ChevronDown,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { UnrecognizedShoppingItem } from "../types";
import {
  useCreatePantryProduct,
  useDeleteShoppingItem,
  useSyncToPantry,
  useHouseholds,
} from "../services/shoppingListService";
import { Specular } from "@loeger-os/shared";
import { cn } from "@/lib/utils";

interface LocalStateItem extends UnrecognizedShoppingItem {
  resolved: "pending" | "saved" | "ignored" | "skipped";
  name: string;
  quantity: number;
  unit: string;
  catalogName?: string;
}

interface EinlagernModalProps {
  listId: string;
  initialItems: UnrecognizedShoppingItem[];
  onClose: () => void;
}

/**
 * Scan & Sync checkout wizard modal supporting multi-household target selection
 * and item-level editing, skipping, deleting, or catalog registering actions.
 */
export function EinlagernModal({ listId, initialItems, onClose }: EinlagernModalProps) {
  const t = useTranslations("Modal");

  // Query available households
  const { data: households = [] } = useHouseholds();
  const [selectedHouseholdId, setSelectedHouseholdId] = useState<string>("");

  useEffect(() => {
    if (households.length > 0 && !selectedHouseholdId) {
      const activeHhId = localStorage.getItem("loeger_os_active_household_id");
      const matched = households.find((h) => h.id === activeHhId);
      setSelectedHouseholdId(matched ? matched.id : households[0].id);
    }
  }, [households, selectedHouseholdId]);

  // Local State representing items being resolved/individualized
  const [items, setItems] = useState<LocalStateItem[]>(
    initialItems.map((i) => ({
      ...i,
      name: i.name,
      quantity: i.quantity,
      unit: i.unit,
      resolved: "pending",
    }))
  );

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editQty, setEditQty] = useState("1");
  const [editUnit, setEditUnit] = useState("Stk");

  const [savingId, setSavingId] = useState<string | null>(null);
  const [catalogInput, setCatalogInput] = useState("");

  const createProduct = useCreatePantryProduct();
  const deleteItem = useDeleteShoppingItem(listId);
  const syncToPantry = useSyncToPantry(listId);

  const pending = items.filter((i) => i.resolved === "pending");
  const allDone = pending.length === 0;

  const startEdit = (item: LocalStateItem) => {
    setEditingId(item.shopping_item_id);
    setEditName(item.name);
    setEditQty(String(item.quantity));
    setEditUnit(item.unit);
  };

  const confirmEdit = (id: string) => {
    const trimmed = editName.trim();
    if (!trimmed) return;
    setItems((prev) =>
      prev.map((i) =>
        i.shopping_item_id === id
          ? {
              ...i,
              name: trimmed,
              quantity: parseFloat(editQty) || 1,
              unit: editUnit,
            }
          : i
      )
    );
    setEditingId(null);
  };

  const startSave = (id: string, currentName: string) => {
    setSavingId(id);
    setCatalogInput(currentName);
  };

  const confirmSave = async (id: string, unit: string) => {
    if (!catalogInput.trim()) return;

    try {
      let baseUnit = "piece";
      const u = unit.toLowerCase();
      if (u === "g" || u === "kg") baseUnit = "g";
      else if (u === "ml" || u === "l") baseUnit = "ml";

      await createProduct.mutateAsync({
        name: catalogInput.trim(),
        base_unit: baseUnit,
        minimum_stock: 0.0,
        householdId: selectedHouseholdId,
      });

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

  const skipItem = (id: string) => {
    setItems((prev) =>
      prev.map((i) =>
        i.shopping_item_id === id ? { ...i, resolved: "skipped" } : i
      )
    );
  };

  const removeItem = (id: string) => {
    deleteItem.mutate(id);
    setItems((prev) =>
      prev.map((i) =>
        i.shopping_item_id === id ? { ...i, resolved: "ignored" } : i
      )
    );
  };

  const handleFinish = async () => {
    try {
      await syncToPantry.mutateAsync({ householdId: selectedHouseholdId });
      onClose();
    } catch {
      onClose();
    }
  };

  const selectedHousehold = households.find((h) => h.id === selectedHouseholdId) || households[0];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-md">
      <div className="relative max-w-[540px] w-full glass-modal rounded-2xl overflow-hidden border border-border/40 shadow-2xl">
        <Specular opacityClassName="via-white/50 dark:via-white/20" />

        <div
          aria-hidden
          className="absolute top-0 left-0 right-0 h-[2.5px] bg-gradient-to-r from-transparent via-blue-500/50 via-cyan-400/80 via-blue-500/50 to-transparent rounded-t-2xl z-20"
        />

        <div className="p-6 md:p-8 space-y-5">
          {/* Header row */}
          <div className="flex justify-between items-start gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-1.5 font-mono text-[9px] font-bold text-cyan-600 dark:text-cyan-400 uppercase tracking-widest leading-none">
                <AlertCircle className="h-3 w-3 shrink-0" strokeWidth={2.5} />
                {t("scanTitle")}
              </div>
              <h2 className="font-heading text-xl font-black uppercase tracking-wide leading-none text-foreground whitespace-pre-line">
                {allDone ? t("allDoneTitle") : t("unresolvedTitle", { count: pending.length })}
              </h2>
            </div>

            <button
              onClick={onClose}
              className="w-8 h-8 rounded-lg flex items-center justify-center cursor-pointer glass-inset hover:glass-active text-muted-foreground hover:text-foreground shrink-0 transition-all duration-300"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Household Selector */}
          <div className="p-3 rounded-xl glass-inset flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-xs font-heading font-extrabold uppercase text-foreground">
              <Building2 className="h-4 w-4 text-primary shrink-0" />
              <span>{t("targetHousehold")}</span>
            </div>

            {households.length > 1 ? (
              <div className="relative">
                <select
                  value={selectedHouseholdId}
                  onChange={(e) => setSelectedHouseholdId(e.target.value)}
                  className="appearance-none bg-card border border-border/60 rounded-lg px-3 py-1.5 pr-8 text-xs font-mono font-bold text-foreground outline-none cursor-pointer"
                >
                  {households.map((hh) => (
                    <option key={hh.id} value={hh.id}>
                      {hh.name} {hh.is_default ? t("defaultTag") : ""}
                    </option>
                  ))}
                </select>
                <ChevronDown className="h-3.5 w-3.5 text-muted-foreground pointer-events-none absolute right-2.5 top-2.5" />
              </div>
            ) : (
              <span className="font-mono text-xs font-bold text-primary px-2 py-1 rounded-md bg-primary/10 border border-primary/20">
                {selectedHousehold?.name || t("defaultTag")}
              </span>
            )}
          </div>

          {/* Unresolved / Batch Items List */}
          {!allDone && (
            <div className="space-y-2.5 max-h-[280px] overflow-y-auto scrollbar-none pr-1">
              {items.map((item) => {
                const isCurrentSaving = savingId === item.shopping_item_id;
                const isCurrentEditing = editingId === item.shopping_item_id;

                return (
                  <div
                    key={item.shopping_item_id}
                    className={cn(
                      "rounded-xl p-3.5 transition-all border",
                      item.resolved === "pending"
                        ? "glass-inset border-border/20"
                        : "bg-white/2 dark:bg-white/[0.01] border-transparent opacity-40"
                    )}
                  >
                    <div className="flex justify-between items-center gap-3">
                      {isCurrentEditing ? (
                        <div className="flex-1 flex gap-2 items-center">
                          <input
                            type="text"
                            value={editName}
                            onChange={(e) => setEditName(e.target.value)}
                            className="flex-1 h-8 px-2 rounded bg-card border border-border/60 text-xs font-heading font-bold uppercase text-foreground outline-none min-w-0"
                          />
                          <input
                            type="text"
                            value={editQty}
                            onChange={(e) => setEditQty(e.target.value)}
                            className="w-12 h-8 px-2 rounded bg-card border border-border/60 text-xs font-mono font-bold text-foreground text-center outline-none"
                          />
                          <button
                            onClick={() => confirmEdit(item.shopping_item_id)}
                            className="h-8 px-2.5 rounded bg-emerald-500 text-white font-bold text-xs cursor-pointer flex items-center justify-center"
                          >
                            <Check className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      ) : (
                        <div className="min-w-0 flex-1">
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
                            {item.resolved === "skipped" && (
                              <span className="text-amber-500 font-bold ml-2">
                                {t("skippedLabel")}
                              </span>
                            )}
                            {item.resolved === "ignored" && (
                              <span className="text-muted-foreground/40 font-bold ml-2">
                                {t("ignoredLabel")}
                              </span>
                            )}
                          </div>
                        </div>
                      )}

                      {item.resolved === "pending" && !isCurrentSaving && !isCurrentEditing && (
                        <div className="flex gap-1 shrink-0 select-none">
                          <button
                            onClick={() => startEdit(item)}
                            className="p-1.5 rounded-lg glass-inset hover:glass-active text-muted-foreground hover:text-foreground cursor-pointer transition-colors"
                            title={t("editItem")}
                          >
                            <Edit2 className="h-3.5 w-3.5" />
                          </button>

                          <button
                            onClick={() => startSave(item.shopping_item_id, item.name)}
                            className="h-8 px-2.5 rounded-lg flex items-center justify-center gap-1 cursor-pointer glass-active font-heading text-[10px] font-black uppercase tracking-wider text-blue-500 dark:text-blue-400"
                            title={t("saveToCatalog")}
                          >
                            <Save className="h-3 w-3 shrink-0" strokeWidth={2.5} />
                            <span>{t("catalogBtn")}</span>
                          </button>

                          <button
                            onClick={() => skipItem(item.shopping_item_id)}
                            className="p-1.5 rounded-lg glass-inset hover:glass-active text-muted-foreground hover:text-amber-400 cursor-pointer transition-colors"
                            title={t("skipItem")}
                          >
                            <SkipForward className="h-3.5 w-3.5" />
                          </button>

                          <button
                            onClick={() => removeItem(item.shopping_item_id)}
                            className="p-1.5 rounded-lg glass-inset hover:bg-red-500/10 text-muted-foreground hover:text-red-400 cursor-pointer transition-colors"
                            title={t("ignoreBtn")}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      )}
                    </div>

                    {isCurrentSaving && (
                      <div className="mt-3 pt-2.5 border-t border-border/10 flex flex-col gap-2 select-none">
                        <label className="font-mono text-[8px] font-bold text-blue-500 uppercase tracking-widest leading-none">
                          {t("catalogBlueprintName")}
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
                            className="flex-1 h-8 px-3 rounded-lg bg-white/5 border border-border/30 outline-none font-heading text-xs font-semibold tracking-wide text-foreground min-w-0"
                          />
                          <button
                            onClick={() => confirmSave(item.shopping_item_id, item.unit)}
                            disabled={createProduct.isPending || !catalogInput.trim()}
                            className="h-8 px-3 rounded-lg flex items-center justify-center font-heading text-xs font-black uppercase tracking-wider text-white bg-gradient-to-br from-blue-400 to-blue-800 disabled:opacity-40 shrink-0 border border-blue-900 shadow-sm cursor-pointer"
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

          {allDone && (
            <div className="p-4 rounded-xl glass-active text-center shrink-0 select-none">
              <span className="font-mono text-[10px] font-bold uppercase tracking-wider text-cyan-600 dark:text-cyan-400 leading-none">
                {t("summaryText", {
                  saved: items.filter((i) => i.resolved === "saved").length,
                  ignored: items.filter((i) => i.resolved === "ignored" || i.resolved === "skipped").length,
                })}
              </span>
            </div>
          )}

          <button
            onClick={allDone ? handleFinish : onClose}
            className="w-full h-11 rounded-xl flex items-center justify-center cursor-pointer glass-inset hover:glass-active text-muted-foreground hover:text-foreground font-heading text-sm font-bold uppercase tracking-wider shrink-0 transition-colors select-none"
          >
            {allDone ? t("doneBtn") : t("laterBtn")}
          </button>
        </div>
      </div>
    </div>
  );
}
