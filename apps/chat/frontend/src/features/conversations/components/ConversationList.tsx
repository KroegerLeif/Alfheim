"use client";

import { useState, useEffect } from "react";
import { useTranslation } from "@alfheim/shared";
import { Cpu, Plus } from "lucide-react";
import {
  useConversations,
  useCreateConversation,
  useDeleteConversation,
  useModelBlocks,
} from "@/features/conversations/services/conversationService";

interface ConversationListProps {
  selectedId: string | null;
  onSelect: (id: string) => void;
  selectedModelBlockId?: string;
  onSelectModelBlockId?: (id: string) => void;
  onOpenModelManager?: () => void;
  onOpenAddModel?: () => void;
}

/**
 * Sidebar list of the user's conversations, with a minimal inline form to start a
 * new one against one of their visible model blocks (own + shared-in-household).
 */
export function ConversationList({
  selectedId,
  onSelect,
  selectedModelBlockId: externalModelBlockId,
  onSelectModelBlockId,
  onOpenModelManager,
  onOpenAddModel,
}: ConversationListProps) {
  const { t } = useTranslation();
  const { data: modelBlocks } = useModelBlocks();
  const { data: conversations, isLoading } = useConversations();
  const createConversation = useCreateConversation();
  const deleteConversation = useDeleteConversation();

  const [internalModelBlockId, setInternalModelBlockId] = useState("");
  const activeModelBlockId = externalModelBlockId ?? internalModelBlockId;

  // Auto-select first model block if none is selected
  useEffect(() => {
    if (modelBlocks && modelBlocks.length > 0) {
      const exists = modelBlocks.some((b) => b.id === activeModelBlockId);
      if (!activeModelBlockId || !exists) {
        const firstId = modelBlocks[0].id;
        if (onSelectModelBlockId) {
          onSelectModelBlockId(firstId);
        } else {
          setInternalModelBlockId(firstId);
        }
      }
    }
  }, [modelBlocks, activeModelBlockId, onSelectModelBlockId]);

  const handleModelChange = (id: string) => {
    if (onSelectModelBlockId) {
      onSelectModelBlockId(id);
    } else {
      setInternalModelBlockId(id);
    }
  };

  const handleCreate = () => {
    if (!activeModelBlockId) return;
    createConversation.mutate(
      { model_block_id: activeModelBlockId },
      {
        onSuccess: (created) => onSelect(created.id),
      }
    );
  };

  const handleDelete = (id: string, event: React.MouseEvent) => {
    event.stopPropagation();
    if (!window.confirm(t("Chat.deleteConfirm"))) return;
    deleteConversation.mutate(id, {
      onSuccess: () => {
        if (selectedId === id) onSelect("");
      },
    });
  };

  return (
    <aside className="w-72 shrink-0 border-r border-[var(--border-subtle)] bg-[var(--surface-card)] flex flex-col h-full">
      <div className="p-4 border-b border-[var(--border-subtle)] space-y-2">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold uppercase tracking-wider text-[var(--text-muted)]">
            {t("Chat.conversations")}
          </h2>
          {onOpenModelManager && (
            <button
              type="button"
              onClick={onOpenModelManager}
              aria-label={t("Chat.manageModels")}
              title={t("Chat.manageModels")}
              className="p-1 rounded-md text-[var(--text-muted)] hover:text-[var(--text-main)] hover:bg-[var(--surface-canvas)] transition-colors cursor-pointer"
            >
              <Cpu className="w-4 h-4" />
            </button>
          )}
        </div>

        {modelBlocks && modelBlocks.length > 0 ? (
          <div className="space-y-2">
            <select
              className="w-full rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-canvas)] text-[var(--text-main)] text-sm px-2 py-1.5"
              value={activeModelBlockId}
              onChange={(e) => handleModelChange(e.target.value)}
            >
              <option value="">{t("Chat.selectModel")}</option>
              {modelBlocks.map((block) => (
                <option key={block.id} value={block.id}>
                  {block.display_name}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={handleCreate}
              disabled={!activeModelBlockId || createConversation.isPending}
              className="w-full rounded-lg bg-[var(--primary-main)] text-black text-sm font-semibold py-1.5 disabled:opacity-50 cursor-pointer"
            >
              {t("Chat.newConversation")}
            </button>
          </div>
        ) : (
          <div className="p-3.5 rounded-xl bg-[var(--surface-canvas)] border border-[var(--border-subtle)] space-y-2.5 text-center">
            <div className="w-8 h-8 rounded-lg bg-[var(--primary-main)]/10 text-[var(--primary-main)] flex items-center justify-center mx-auto">
              <Cpu className="w-4 h-4" />
            </div>
            <div className="space-y-1">
              <p className="text-xs font-bold text-[var(--text-main)]">
                {t("Chat.noModelsConfiguredTitle")}
              </p>
              <p className="text-[11px] text-[var(--text-muted)] leading-relaxed">
                {t("Chat.noModelBlocksPrompt")}
              </p>
            </div>
            {(onOpenAddModel || onOpenModelManager) && (
              <button
                type="button"
                onClick={onOpenAddModel || onOpenModelManager}
                className="w-full rounded-lg bg-[var(--primary-main)] text-black text-xs font-bold py-1.5 flex items-center justify-center gap-1.5 hover:opacity-90 transition-opacity cursor-pointer shadow-sm"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>{t("Chat.addModelBlock")}</span>
              </button>
            )}
          </div>
        )}
      </div>

      <div className="flex-1 overflow-y-auto">
        {isLoading && <p className="p-4 text-sm text-[var(--text-muted)]">…</p>}
        {conversations && conversations.length === 0 && (
          <p className="p-4 text-sm text-[var(--text-muted)]">{t("Chat.noConversations")}</p>
        )}
        {conversations?.map((conversation) => (
          <div
            key={conversation.id}
            className={`w-full border-b border-[var(--border-subtle)] flex items-center gap-2 hover:bg-[var(--surface-canvas)] ${
              selectedId === conversation.id ? "bg-[var(--surface-canvas)]" : ""
            }`}
          >
            <button
              type="button"
              onClick={() => onSelect(conversation.id)}
              className="flex-1 min-w-0 text-left px-4 py-3 truncate text-sm text-[var(--text-main)] cursor-pointer"
            >
              {conversation.title || t("Chat.untitledConversation")}
            </button>
            <button
              type="button"
              onClick={(e) => handleDelete(conversation.id, e)}
              className="pr-4 text-xs text-[var(--text-muted)] hover:text-red-400 shrink-0 cursor-pointer"
              aria-label={t("Chat.deleteConfirm")}
            >
              ✕
            </button>
          </div>
        ))}
      </div>
    </aside>
  );
}
