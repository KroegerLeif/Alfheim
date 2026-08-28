"use client";

import { useState } from "react";
import { ChatStreamView, ConversationList } from "@/features/conversations";
import {
  ModelBlockFormModal,
  ModelBlockManagementView,
  useCreateModelBlock,
} from "@/features/model-blocks";

/**
 * Chat app entry page: a conversation list side panel plus the streaming chat view,
 * with model block management overlay.
 */
export default function ChatPage() {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [isModelManagerOpen, setIsModelManagerOpen] = useState(false);
  const [isAddModelOpen, setIsAddModelOpen] = useState(false);
  const createMutation = useCreateModelBlock();

  return (
    <div className="flex h-full min-h-0 relative">
      <ConversationList
        selectedId={selectedId}
        onSelect={(id) => setSelectedId(id || null)}
        onOpenModelManager={() => setIsModelManagerOpen(true)}
        onOpenAddModel={() => setIsAddModelOpen(true)}
      />
      <ChatStreamView conversationId={selectedId} />

      <ModelBlockManagementView
        isOpen={isModelManagerOpen}
        onClose={() => setIsModelManagerOpen(false)}
      />

      <ModelBlockFormModal
        isOpen={isAddModelOpen}
        onClose={() => setIsAddModelOpen(false)}
        onSubmit={(payload) => {
          if (!("id" in payload)) {
            createMutation.mutate(payload, {
              onSuccess: () => setIsAddModelOpen(false),
            });
          }
        }}
        isPending={createMutation.isPending}
      />
    </div>
  );
}
