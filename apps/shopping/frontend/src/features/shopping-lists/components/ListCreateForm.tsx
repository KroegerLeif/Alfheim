"use client";

import React from "react";
import { useTranslations } from "next-intl";
import { Check, X } from "lucide-react";

interface ListCreateFormProps {
  newListName: string;
  setNewListName: (val: string) => void;
  onCreate: () => void;
  onCancel: () => void;
  isPending: boolean;
}

export function ListCreateForm({
  newListName,
  setNewListName,
  onCreate,
  onCancel,
  isPending,
}: ListCreateFormProps) {
  const tNav = useTranslations("Navigation");

  return (
    <div className="flex items-center gap-1 px-2.5 h-9 bg-[var(--surface-elevated)] rounded-xl border border-[var(--border-subtle)] shrink-0">
      <input
        type="text"
        value={newListName}
        onChange={(e) => setNewListName(e.target.value)}
        placeholder={tNav("newListPlaceholder")}
        className="bg-transparent border-none outline-none font-heading text-xs font-bold uppercase tracking-wider text-[var(--text-main)] placeholder:[var(--text-muted)] w-24"
        autoFocus
        onKeyDown={(e) => {
          if (e.key === "Enter") onCreate();
          if (e.key === "Escape") onCancel();
        }}
      />
      <button
        onClick={onCreate}
        disabled={!newListName.trim() || isPending}
        className="text-green-500 hover:text-green-400 p-1 cursor-pointer disabled:opacity-40"
      >
        <Check className="h-3.5 w-3.5" />
      </button>
      <button
        onClick={onCancel}
        className="text-red-500 hover:text-red-400 p-1 cursor-pointer"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
