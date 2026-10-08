"use client";

import { useState, useMemo } from "react";
import { useTranslations } from "next-intl";
import { useActiveHousehold } from "@alfheim/shared";
import type { UnrecognizedShoppingItem } from "../types";
import { useHouseholds } from "../services/shoppingListService";
import { useEinlagernItems } from "../hooks/useEinlagernItems";
import { EinlagernItemRow } from "./EinlagernItemRow";
import { EinlagernModalHeader } from "./EinlagernModalHeader";

interface EinlagernModalProps {
  listId: string;
  initialItems: UnrecognizedShoppingItem[];
  onClose: () => void;
}

/**
 * Dialog that resolves the items Pantry could not match during stock-in. Every item is handled on
 * its own (saved to the catalog and stocked, skipped or removed), so "Done" only closes the dialog.
 */
export function EinlagernModal({ listId, initialItems = [], onClose }: EinlagernModalProps) {
  const t = useTranslations("Modal");

  const { householdId: activeHouseholdId } = useActiveHousehold();
  const { data: householdsData } = useHouseholds();
  const households = useMemo(() => householdsData ?? [], [householdsData]);
  const [selectedHouseholdId, setSelectedHouseholdId] = useState<string>("");

  const resolvedHouseholdId = useMemo(() => {
    if (selectedHouseholdId) return selectedHouseholdId;
    if (households.length === 0) return "";
    const matched = households.find((h) => h.id === activeHouseholdId);
    return matched ? matched.id : households[0].id;
  }, [selectedHouseholdId, households, activeHouseholdId]);

  const { items, pendingCount, isCreatingProduct, persistEdit, saveToCatalog, skip, remove } = useEinlagernItems(
    listId,
    initialItems,
    resolvedHouseholdId
  );
  const allDone = pendingCount === 0;
  const selectedHousehold = households.find((h) => h.id === resolvedHouseholdId) || households[0];

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={t("scanTitle")}
      className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-200"
    >
      <div className="relative max-w-[540px] w-full max-h-full overflow-y-auto bg-[var(--surface-card)] rounded-2xl border border-[var(--border-subtle)] shadow-2xl">
        <div className="p-6 md:p-8 space-y-5">
          <EinlagernModalHeader
            allDone={allDone}
            pendingCount={pendingCount}
            onClose={onClose}
            households={households}
            resolvedHouseholdId={resolvedHouseholdId}
            setSelectedHouseholdId={setSelectedHouseholdId}
            selectedHousehold={selectedHousehold}
          />

          {!allDone && (
            <div className="space-y-2.5 max-h-[280px] overflow-y-auto scrollbar-none pr-1">
              {items.map((item) => (
                <EinlagernItemRow
                  key={item.shopping_item_id}
                  item={item}
                  onEdit={(name, qty) => persistEdit(item.shopping_item_id, { name, quantity: qty })}
                  onSaveCatalog={(catalogName) => saveToCatalog(item.shopping_item_id, catalogName)}
                  onSkip={() => skip(item.shopping_item_id)}
                  onRemove={() => remove(item.shopping_item_id)}
                  isCreateProductPending={isCreatingProduct}
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
            type="button"
            onClick={onClose}
            className="w-full h-11 rounded-xl flex items-center justify-center cursor-pointer bg-[var(--surface-elevated)] hover:bg-[var(--primary-main)] text-[var(--text-main)] hover:text-slate-950 font-heading text-sm font-bold uppercase tracking-wider shrink-0 transition-colors select-none"
          >
            {allDone ? t("doneBtn") : t("laterBtn")}
          </button>
        </div>
      </div>
    </div>
  );
}
