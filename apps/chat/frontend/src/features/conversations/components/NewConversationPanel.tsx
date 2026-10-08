"use client";

import { useTranslation } from "@alfheim/shared";
import { Cpu, Plus } from "lucide-react";
import type { ModelBlock } from "@/features/conversations/types";

interface NewConversationPanelProps {
  modelBlocks: ModelBlock[];
  modelBlockId: string;
  onModelBlockChange: (id: string) => void;
  onCreate: () => void;
  isCreating: boolean;
  createFailed: boolean;
  onOpenAddModel?: () => void;
}

/**
 * Picks the model block for the next new conversation and starts one. The choice never
 * changes the model of a conversation that already exists.
 */
export function NewConversationPanel({
  modelBlocks,
  modelBlockId,
  onModelBlockChange,
  onCreate,
  isCreating,
  createFailed,
  onOpenAddModel,
}: NewConversationPanelProps) {
  const { t } = useTranslation();

  if (modelBlocks.length === 0) {
    return (
      <div className="p-3.5 rounded-xl bg-[var(--surface-canvas)] border border-[var(--border-subtle)] space-y-2.5 text-center">
        <div className="w-8 h-8 rounded-lg bg-[var(--primary-main)]/10 text-[var(--primary-main)] flex items-center justify-center mx-auto">
          <Cpu className="w-4 h-4" />
        </div>
        <div className="space-y-1">
          <p className="text-xs font-bold text-[var(--text-main)]">{t("Chat.noModelsConfiguredTitle")}</p>
          <p className="text-[11px] text-[var(--text-muted)] leading-relaxed">{t("Chat.noModelBlocksPrompt")}</p>
        </div>
        {onOpenAddModel && (
          <button
            type="button"
            onClick={onOpenAddModel}
            className="w-full rounded-lg bg-[var(--primary-main)] text-black text-xs font-bold py-1.5 flex items-center justify-center gap-1.5 hover:opacity-90 transition-opacity cursor-pointer shadow-sm"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>{t("Chat.addModelBlock")}</span>
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <label className="block space-y-1">
        <span className="block text-[11px] font-semibold text-[var(--text-muted)]">{t("Chat.newConversationModel")}</span>
        <select
          className="w-full min-w-0 truncate rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-canvas)] text-[var(--text-main)] text-sm px-2 py-1.5"
          value={modelBlockId}
          onChange={(e) => onModelBlockChange(e.target.value)}
        >
          <option value="">{t("Chat.selectModel")}</option>
          {modelBlocks.map((block) => (
            <option key={block.id} value={block.id}>
              {block.display_name}
            </option>
          ))}
        </select>
      </label>
      <button
        type="button"
        onClick={onCreate}
        disabled={!modelBlockId || isCreating}
        className="w-full rounded-lg bg-[var(--primary-main)] text-black text-sm font-semibold py-1.5 disabled:opacity-50 cursor-pointer"
      >
        {t("Chat.newConversation")}
      </button>
      {createFailed && (
        <p role="alert" className="text-xs text-red-400">
          {t("Chat.createError")}
        </p>
      )}
    </div>
  );
}
