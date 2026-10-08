"use client";

import { useState } from "react";
import { Plus, ChevronUp, ChevronDown, Search } from "lucide-react";
import { useTranslations } from "next-intl";
import { UnitSelector } from "./UnitSelector";
import { DEFAULT_UNIT } from "../utils/units";
import { useAddShoppingItem, useShoppingLists } from "../services/shoppingListService";
import { cn } from "@/lib/utils";

interface AddManualItemProps {
  listId: string;
}

/**
 * Control block card for adding a manual checklist item (name, quantity and unit).
 */
export function AddManualItem({ listId }: AddManualItemProps) {
  const t = useTranslations("AddForm");

  // Local Form state
  const [name, setName] = useState("");
  const [qty, setQty] = useState("1");
  const [unit, setUnit] = useState<string>(DEFAULT_UNIT);

  const { data: lists = [] } = useShoppingLists();
  const effectiveListId = listId || (lists.length > 0 ? lists[0].id : "");

  const addItem = useAddShoppingItem(effectiveListId);

  const handleIncrement = () => {
    const current = parseFloat(qty) || 0;
    setQty(String(current + 1));
  };

  const handleDecrement = () => {
    const current = parseFloat(qty) || 1;
    if (current <= 0.5) return;
    const nextVal = current > 1 ? current - 1 : current - 0.5;
    setQty(String(nextVal));
  };

  const handleSubmit = () => {
    const trimmed = name.trim();
    if (!trimmed) return;

    addItem.mutate(
      {
        name: trimmed,
        quantity: parseFloat(qty) || 1,
        unit,
      },
      {
        onSuccess: () => {
          setName("");
          setQty("1");
        },
      }
    );
  };

  const isInvalid = !name.trim() || addItem.isPending;

  return (
    <div className="bg-[var(--surface-card)] border border-[var(--border-subtle)] rounded-2xl p-5 relative shrink-0 select-none">
      <div className="relative z-10 flex flex-col gap-3">
        <h3 className="font-mono text-[9px] font-bold uppercase tracking-widest text-[var(--primary-main)] leading-none">
          {t("title")}
        </h3>

        {/* Name input */}
        <div className="flex items-center gap-2">
          <div className="flex-1 flex items-center gap-3 h-11 pl-4 pr-1.5 rounded-xl bg-[var(--surface-canvas)] border border-[var(--border-subtle)] min-w-0">
            <Search className="h-4 w-4 text-[var(--text-muted)] shrink-0" />
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && !isInvalid && handleSubmit()}
              placeholder={t("namePlaceholder")}
              aria-label={t("nameLabel")}
              maxLength={255}
              className="flex-1 bg-transparent border-none outline-none font-heading text-sm font-semibold tracking-wide text-[var(--text-main)] placeholder:[var(--text-muted)] min-w-0"
              disabled={addItem.isPending}
            />
          </div>
        </div>

        {/* Stepper + Unit Selector + Submit Row */}
        <div className="flex gap-2">
          <div className="flex items-center h-10 rounded-lg bg-[var(--surface-canvas)] border border-[var(--border-subtle)] overflow-hidden shrink-0">
            <button
              type="button"
              onClick={handleDecrement}
              disabled={addItem.isPending}
              aria-label={t("stepperDec")}
              className="w-9 h-full flex items-center justify-center cursor-pointer text-[var(--text-muted)] hover:text-[var(--primary-main)] hover:bg-[var(--surface-elevated)] transition-colors disabled:opacity-40"
            >
              <ChevronDown className="h-4 w-4" strokeWidth={2.5} />
            </button>
            <input
              type="text"
              inputMode="decimal"
              value={qty}
              onChange={(e) => setQty(e.target.value)}
              aria-label={t("quantityLabel")}
              className="w-10 h-full bg-transparent border-none outline-none text-center font-mono text-sm font-bold text-[var(--text-main)]"
              disabled={addItem.isPending}
            />
            <button
              type="button"
              onClick={handleIncrement}
              disabled={addItem.isPending}
              aria-label={t("stepperInc")}
              className="w-9 h-full flex items-center justify-center cursor-pointer text-[var(--text-muted)] hover:text-[var(--primary-main)] hover:bg-[var(--surface-elevated)] transition-colors disabled:opacity-40"
            >
              <ChevronUp className="h-4 w-4" strokeWidth={2.5} />
            </button>
          </div>

          <UnitSelector value={unit} onChange={setUnit} />

          <button
            type="button"
            onClick={handleSubmit}
            disabled={isInvalid}
            className={cn(
              "flex-1 h-10 px-5 rounded-lg flex items-center justify-center gap-1.5 font-heading text-xs font-bold uppercase tracking-wider transition-all text-slate-950 shrink-0 shadow-md",
              isInvalid
                ? "bg-[var(--surface-elevated)] text-[var(--text-muted)] border-transparent pointer-events-none opacity-40 shadow-none"
                : "bg-[var(--primary-main)] hover:bg-[var(--primary-hover)] cursor-pointer"
            )}
          >
            <Plus className="h-3.5 w-3.5" strokeWidth={3} />
            {t("addBtn")}
          </button>
        </div>
      </div>
    </div>
  );
}
