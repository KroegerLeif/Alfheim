"use client";

import * as React from "react";
import { useTranslation } from "@alfheim/shared";
import { Button } from "@/components/ui/button";
import { Plus, Minus, Loader2 } from "lucide-react";
import { useLocations } from "@/features/locations/services/locationService";
import { useCreateTransaction } from "@/features/inventory/services/inventoryService";
import { ProductRead } from "@/features/products/types";

interface TransactionFormProps {
  mode: "in" | "out";
  selectedProduct: ProductRead;
  onSuccess: () => void;
}

const QUICK_PICKS = [1, 2, 3, 6, 12];

/**
 * TransactionForm
 * Handles quantity, location, batch, expiry, and notes input for a stock transaction.
 */
export function TransactionForm({ mode, selectedProduct, onSuccess }: TransactionFormProps) {
  const { t } = useTranslation();

  const { data: locations = [] } = useLocations();
  const createTransactionMut = useCreateTransaction();

  const [selectedLocationId, setSelectedLocationId] = React.useState("");
  const [quantity, setQuantity] = React.useState(1);
  const [unit, setUnit] = React.useState(selectedProduct.base_unit || "piece");
  const [batchCode, setBatchCode] = React.useState("");
  const [expirationDate, setExpirationDate] = React.useState("");
  const [notes, setNotes] = React.useState("");

  // Auto-select the backlog system location on mount
  React.useEffect(() => {
    if (locations.length > 0 && !selectedLocationId) {
      const systemBacklog =
        locations.find((loc) => loc.is_system && loc.name.toLowerCase() === "backlog") ??
        locations[0];
      setSelectedLocationId(systemBacklog.id);
    }
  }, [locations, selectedLocationId]);

  const adjustQuantity = (delta: number) =>
    setQuantity((prev) => Math.max(0.1, parseFloat((prev + delta).toFixed(2))));

  const handleSubmit = () => {
    if (!selectedLocationId || !unit.trim()) return;
    createTransactionMut.mutate(
      {
        product_id: selectedProduct.id,
        location_id: selectedLocationId,
        transaction_type: mode,
        quantity_input: quantity,
        unit_input: unit,
        batch_code: batchCode.trim() || null,
        expiration_date: expirationDate || null,
        notes: notes.trim() || null,
      },
      { onSuccess }
    );
  };

  return (
    <div className="space-y-5 my-4">
      {/* Selected product summary */}
      <div className="border border-[var(--border-accent)] bg-[var(--surface-elevated)] p-3 rounded flex items-center justify-between">
        <div>
          <div className="font-bold uppercase text-sm tracking-tight">{selectedProduct.name}</div>
          {selectedProduct.brand && (
            <div className="text-[10px] text-[var(--text-muted)] uppercase">{selectedProduct.brand}</div>
          )}
        </div>
        <span className="text-[9px] font-bold px-1.5 py-0.5 uppercase border border-[var(--primary-main)] text-[var(--primary-main)] rounded">
          {selectedProduct.base_unit}
        </span>
      </div>

      {/* Quantity stepper */}
      <div className="space-y-2">
        <label className="text-xs font-bold uppercase block">{t("pantry.quantity")}</label>
        <div className="flex items-center gap-3">
          <Button type="button" variant="outline" size="sm" onClick={() => adjustQuantity(-1)} className="h-10 w-10 p-0">
            <Minus className="h-4 w-4" />
          </Button>
          <input type="number" step="any" min="0.1" value={quantity}
            onChange={(e) => setQuantity(Math.max(0.1, parseFloat(e.target.value) || 0.1))}
            className="flex-1 text-center p-2 border border-[var(--border-subtle)] bg-[var(--surface-canvas)] text-[var(--text-main)] text-lg font-black font-mono rounded" />
          <Button type="button" variant="outline" size="sm" onClick={() => adjustQuantity(1)} className="h-10 w-10 p-0">
            <Plus className="h-4 w-4" />
          </Button>
        </div>
        <div className="flex gap-2 flex-wrap">
          {QUICK_PICKS.map((val) => (
            <button key={val} type="button" onClick={() => setQuantity(val)}
              className="text-xs font-bold px-3 py-1.5 border border-[var(--border-subtle)] hover:border-[var(--primary-main)] hover:text-[var(--primary-main)] transition-colors rounded font-mono">
              {val}
            </button>
          ))}
        </div>
      </div>

      {/* Unit + Location */}
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1">
          <label className="text-xs font-bold uppercase block">{t("pantry.baseUnit")}</label>
          <input type="text" value={unit} onChange={(e) => setUnit(e.target.value)}
            className="w-full p-2.5 border border-[var(--border-subtle)] bg-[var(--surface-canvas)] text-[var(--text-main)] text-sm rounded font-mono" />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-bold uppercase block">{t("pantry.location")}</label>
          <select value={selectedLocationId} onChange={(e) => setSelectedLocationId(e.target.value)}
            className="w-full p-2.5 border border-[var(--border-subtle)] bg-[var(--surface-canvas)] text-[var(--text-main)] text-sm rounded uppercase font-mono">
            {locations.map((loc) => <option key={loc.id} value={loc.id}>{loc.name}</option>)}
          </select>
        </div>
      </div>

      {/* Optional metadata */}
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1">
          <label className="text-xs font-bold uppercase block">{t("pantry.batchLabel")}</label>
          <input type="text" value={batchCode} onChange={(e) => setBatchCode(e.target.value)}
            placeholder="e.g. LOT-2024-A"
            className="w-full p-2.5 border border-[var(--border-subtle)] bg-[var(--surface-canvas)] text-[var(--text-main)] text-sm rounded font-mono" />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-bold uppercase block">{t("pantry.expiration")}</label>
          <input type="date" value={expirationDate} onChange={(e) => setExpirationDate(e.target.value)}
            className="w-full p-2.5 border border-[var(--border-subtle)] bg-[var(--surface-canvas)] text-[var(--text-main)] text-sm rounded font-mono" />
        </div>
      </div>

      <div className="space-y-1">
        <label className="text-xs font-bold uppercase block">{t("pantry.notes")}</label>
        <input type="text" value={notes} onChange={(e) => setNotes(e.target.value)}
          placeholder={t("pantry.notesPlaceholder")}
          className="w-full p-2.5 border border-[var(--border-subtle)] bg-[var(--surface-canvas)] text-[var(--text-main)] text-sm rounded font-mono" />
      </div>

      <Button onClick={handleSubmit}
        disabled={createTransactionMut.isPending || !selectedLocationId || !unit.trim()}
        className="w-full py-5 text-sm font-black tracking-widest border-2 border-[var(--border-accent)] bg-[var(--primary-main)] text-black hover:bg-[var(--primary-hover)] flex items-center justify-center gap-2 rounded-lg">
        {createTransactionMut.isPending ? (
          <><Loader2 className="h-4 w-4 animate-spin" />{t("pantry.submitting")}</>
        ) : (
          mode === "in" ? t("pantry.transactionModalTitleIn") : t("pantry.transactionModalTitleOut")
        )}
      </Button>
    </div>
  );
}
