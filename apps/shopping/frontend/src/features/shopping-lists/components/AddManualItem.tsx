"use client";

import { useState } from "react";
import { Plus, ChevronUp, ChevronDown, Search } from "lucide-react";
import { useTranslations } from "next-intl";
import { UnitSelector } from "./UnitSelector";
import { useAddShoppingItem, useShoppingLists } from "../services/shoppingListService";
import { Specular } from "@/components/shared/Specular";
import { cn } from "@/lib/utils";

interface AddManualItemProps {
  listId: string;
}

/**
 * Control block card containing manual checklist item additions.
 */
export function AddManualItem({ listId }: AddManualItemProps) {
  const t = useTranslations("AddForm");

  // Local Form state
  const [name, setName] = useState("");
  const [qty, setQty] = useState("1");
  const [unit, setUnit] = useState("Stk");

  // Retrieve lists to default active ID if empty
  const { data: lists = [] } = useShoppingLists();
  const effectiveListId = listId || (lists.length > 0 ? lists[0].id : "");

  // Mutation
  const addItem = useAddShoppingItem(effectiveListId);

  const handleIncrement = () => {
    const current = parseFloat(qty) || 0;
    setQty(String(current + 1));
  };

  const handleDecrement = () => {
    const current = parseFloat(qty) || 1;
    if (current <= 0.5) return;
    
    // Decrement by 0.5 if value <= 1, otherwise by 1
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
          // Reset input fields only on success
          setName("");
          setQty("1");
        },
      }
    );
  };

  const isInvalid = !name.trim() || addItem.isPending;

  return (
    <div className="glass-card rounded-2xl p-5 relative overflow-hidden shrink-0 select-none">
      <Specular opacityClassName="via-white/20 dark:via-white/10" />

      <div className="relative z-10 flex flex-col gap-3">
        <h3 className="font-mono text-[9px] font-bold uppercase tracking-widest text-blue-500 dark:text-blue-400 leading-none">
          {t("title")}
        </h3>

        {/* Text Input Row */}
        <div className="flex items-center gap-3 h-11 px-4 rounded-xl glass-inset">
          <Search className="h-4 w-4 text-muted-foreground/40 shrink-0" />
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && !isInvalid && handleSubmit()}
            placeholder={t("namePlaceholder")}
            className="flex-1 bg-transparent border-none outline-none font-heading text-sm font-semibold tracking-wide text-foreground placeholder:text-muted-foreground/35 min-w-0"
            disabled={addItem.isPending}
          />
        </div>

        {/* Stepper + Unit Selector + Submit Row */}
        <div className="flex gap-2">
          {/* Stepper controls */}
          <div className="flex items-center h-10 rounded-lg glass-inset overflow-hidden shrink-0">
            <button
              onClick={handleDecrement}
              disabled={addItem.isPending}
              aria-label={t("stepperDec")}
              className="w-9 h-full flex items-center justify-center cursor-pointer 
                         text-muted-foreground/50 hover:text-blue-500 hover:bg-white/2 transition-colors disabled:opacity-40"
            >
              <ChevronDown className="h-4 w-4" strokeWidth={2.5} />
            </button>
            <input
              type="text"
              value={qty}
              onChange={(e) => setQty(e.target.value)}
              className="w-10 h-full bg-transparent border-none outline-none text-center font-mono text-sm font-bold text-foreground"
              disabled={addItem.isPending}
            />
            <button
              onClick={handleIncrement}
              disabled={addItem.isPending}
              aria-label={t("stepperInc")}
              className="w-9 h-full flex items-center justify-center cursor-pointer 
                         text-muted-foreground/50 hover:text-blue-500 hover:bg-white/2 transition-colors disabled:opacity-40"
            >
              <ChevronUp className="h-4 w-4" strokeWidth={2.5} />
            </button>
          </div>

          {/* Radix Popover Unit Picker */}
          <UnitSelector value={unit} onChange={setUnit} />

          {/* Add submit button */}
          <button
            onClick={handleSubmit}
            disabled={isInvalid}
            className={cn(
              "flex-1 h-10 px-5 rounded-lg flex items-center justify-center gap-1.5 font-heading text-xs font-black uppercase tracking-wider transition-all duration-300 text-white shrink-0 shadow-md",
              isInvalid
                ? "glass-inset text-muted-foreground/45 border-transparent pointer-events-none opacity-40 shadow-none"
                : "bg-gradient-to-br from-blue-400 via-blue-500 to-blue-800 hover:scale-[1.01] hover:shadow-blue-500/25 border-t border-blue-300/40 border-l border-blue-300/20 border-r border-blue-900/30 border-b border-blue-950/40 cursor-pointer"
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
