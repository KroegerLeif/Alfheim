"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Check, X, Plus } from "lucide-react";

interface CreateListFormProps {
  onSave: (name: string) => void;
  isPending: boolean;
}

export function CreateListForm({ onSave, isPending }: CreateListFormProps) {
  const t = useTranslations("Navigation");
  const [isCreating, setIsCreating] = useState(false);
  const [newListName, setNewListName] = useState("");

  const handleCreate = () => {
    const trimmed = newListName.trim();
    if (!trimmed) return;
    onSave(trimmed);
    setNewListName("");
    setIsCreating(false);
  };

  const handleCancel = () => {
    setIsCreating(false);
    setNewListName("");
  };

  return (
    <div className="pt-2">
      {isCreating ? (
        <div className="flex items-center gap-1.5 px-3 h-10 rounded-xl border border-border/60 glass-inset">
          <input
            type="text"
            value={newListName}
            onChange={(e) => setNewListName(e.target.value)}
            placeholder={t("newListPlaceholder")}
            className="flex-1 bg-transparent border-none outline-none text-xs font-heading font-bold uppercase tracking-wider text-foreground placeholder:text-muted-foreground/40 min-w-0"
            autoFocus
            onKeyDown={(e) => {
              if (e.key === "Enter") handleCreate();
              if (e.key === "Escape") handleCancel();
            }}
          />
          <button
            onClick={handleCreate}
            disabled={!newListName.trim() || isPending}
            className="text-emerald-500 hover:text-emerald-400 p-1 cursor-pointer disabled:opacity-40 transition-colors"
          >
            <Check className="h-4 w-4" />
          </button>
          <button
            onClick={handleCancel}
            className="text-red-500 hover:text-red-400 p-1 cursor-pointer transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      ) : (
        <button
          onClick={() => setIsCreating(true)}
          className="w-full flex items-center justify-center gap-2 h-10 rounded-xl border border-dashed border-border/60 text-muted-foreground hover:text-primary hover:border-primary/50 transition-all duration-200 cursor-pointer text-xs font-heading font-bold uppercase tracking-wider"
        >
          <Plus className="h-4 w-4" />
          {t("newList")}
        </button>
      )}
    </div>
  );
}
