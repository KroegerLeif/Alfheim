"use client";

import { useEffect, useState } from "react";
import { useTranslation } from "@alfheim/shared";
import { Cpu, X } from "lucide-react";
import {
  useConversations,
  useCreateConversation,
  useDeleteConversation,
  useModelBlocks,
} from "@/features/conversations/services/conversationService";
import { NewConversationPanel } from "./NewConversationPanel";

interface ConversationListProps {
  selectedId: string | null;
  onSelect: (id: string) => void;
  /** Model block for the next new conversation (controlled by the page). */
  selectedModelBlockId?: string;
  onSelectModelBlockId?: (id: string) => void;
  onOpenModelManager?: () => void;
  onOpenAddModel?: () => void;
  className?: string;
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
  className = "flex",
}: ConversationListProps) {
  const { t } = useTranslation();
  const { data: modelBlocksData } = useModelBlocks();
  const { data: conversationsData, isLoading, isError } = useConversations();
  const createConversation = useCreateConversation();
  const deleteConversation = useDeleteConversation();
  const modelBlocks = modelBlocksData ?? [];
  const conversations = conversationsData ?? [];

  const [internalModelBlockId, setInternalModelBlockId] = useState("");
  const activeModelBlockId = externalModelBlockId ?? internalModelBlockId;
  const setModelBlockId = onSelectModelBlockId ?? setInternalModelBlockId;

  // Default the new-conversation model to the first visible block.
  useEffect(() => {
    if (modelBlocks.length > 0 && !modelBlocks.some((b) => b.id === activeModelBlockId)) {
      setModelBlockId(modelBlocks[0].id);
    }
  }, [modelBlocks, activeModelBlockId, setModelBlockId]);

  const handleCreate = () => {
    if (!activeModelBlockId) return;
    createConversation.mutate({ model_block_id: activeModelBlockId }, { onSuccess: (created) => onSelect(created.id) });
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
    <aside className={`w-full md:w-72 shrink-0 border-r border-[var(--border-subtle)] bg-[var(--surface-card)] flex-col h-full min-w-0 ${className}`}>
      <div className="p-4 border-b border-[var(--border-subtle)] space-y-2">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-sm font-bold uppercase tracking-wider text-[var(--text-muted)] truncate">
            {t("Chat.conversations")}
          </h2>
          {onOpenModelManager && (
            <button
              type="button"
              onClick={onOpenModelManager}
              aria-label={t("Chat.manageModels")}
              title={t("Chat.manageModels")}
              className="p-1 rounded-md text-[var(--text-muted)] hover:text-[var(--text-main)] hover:bg-[var(--surface-canvas)] transition-colors cursor-pointer shrink-0"
            >
              <Cpu className="w-4 h-4" />
            </button>
          )}
        </div>

        <NewConversationPanel
          modelBlocks={modelBlocks}
          modelBlockId={activeModelBlockId}
          onModelBlockChange={setModelBlockId}
          onCreate={handleCreate}
          isCreating={createConversation.isPending}
          createFailed={createConversation.isError}
          onOpenAddModel={onOpenAddModel ?? onOpenModelManager}
        />
      </div>

      <div className="flex-1 overflow-y-auto">
        {isLoading && <p className="p-4 text-sm text-[var(--text-muted)]">{t("common.loading")}</p>}
        {isError && <p role="alert" className="p-4 text-sm text-red-400">{t("Chat.conversationsLoadError")}</p>}
        {deleteConversation.isError && (
          <p role="alert" className="px-4 pt-3 text-xs text-red-400">{t("Chat.deleteError")}</p>
        )}
        {!isLoading && !isError && conversations.length === 0 && (
          <p className="p-4 text-sm text-[var(--text-muted)]">{t("Chat.noConversations")}</p>
        )}
        {conversations.map((conversation) => (
          <div
            key={conversation.id}
            className={`w-full border-b border-[var(--border-subtle)] flex items-center gap-2 hover:bg-[var(--surface-canvas)] ${
              selectedId === conversation.id ? "bg-[var(--surface-canvas)]" : ""
            }`}
          >
            <button
              type="button"
              onClick={() => onSelect(conversation.id)}
              title={conversation.title || undefined}
              className="flex-1 min-w-0 text-left px-4 py-3 truncate text-sm text-[var(--text-main)] cursor-pointer"
            >
              {conversation.title || t("Chat.untitledConversation")}
            </button>
            <button
              type="button"
              onClick={(e) => handleDelete(conversation.id, e)}
              disabled={deleteConversation.isPending}
              className="mr-3 p-1 rounded-md text-[var(--text-muted)] hover:text-red-400 shrink-0 cursor-pointer disabled:opacity-50"
              aria-label={t("Chat.deleteConversation")}
              title={t("Chat.deleteConversation")}
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        ))}
      </div>
    </aside>
  );
}
