"use client";

import { useState } from "react";
import { useTranslation } from "@alfheim/shared";
import {
  useConversations,
  useCreateConversation,
  useDeleteConversation,
  useModelBlocks,
} from "@/features/conversations/services/conversationService";

interface ConversationListProps {
  selectedId: string | null;
  onSelect: (id: string) => void;
}

/**
 * Sidebar list of the user's conversations, with a minimal inline form to start a
 * new one against one of their visible model blocks (own + shared-in-household).
 */
export function ConversationList({ selectedId, onSelect }: ConversationListProps) {
  const { t } = useTranslation();
  const { data: conversations, isLoading } = useConversations();
  const { data: modelBlocks } = useModelBlocks();
  const createConversation = useCreateConversation();
  const deleteConversation = useDeleteConversation();

  const [selectedModelBlockId, setSelectedModelBlockId] = useState("");

  const handleCreate = () => {
    if (!selectedModelBlockId) return;
    createConversation.mutate(
      { model_block_id: selectedModelBlockId },
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
        <h2 className="text-sm font-bold uppercase tracking-wider text-[var(--text-muted)]">
          {t("Chat.conversations")}
        </h2>

        {modelBlocks && modelBlocks.length > 0 ? (
          <div className="space-y-2">
            <select
              className="w-full rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-canvas)] text-[var(--text-main)] text-sm px-2 py-1.5"
              value={selectedModelBlockId}
              onChange={(e) => setSelectedModelBlockId(e.target.value)}
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
              disabled={!selectedModelBlockId || createConversation.isPending}
              className="w-full rounded-lg bg-[var(--primary-main)] text-black text-sm font-semibold py-1.5 disabled:opacity-50 cursor-pointer"
            >
              {t("Chat.newConversation")}
            </button>
          </div>
        ) : (
          <p className="text-xs text-[var(--text-muted)]">{t("Chat.noModelBlocks")}</p>
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
