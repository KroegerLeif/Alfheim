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
  const [selectedModelBlockId, setSelectedModelBlockId] = useState<string>("");
  const [isModelManagerOpen, setIsModelManagerOpen] = useState(false);
  const [isAddModelOpen, setIsAddModelOpen] = useState(false);
  const createMutation = useCreateModelBlock();

  return (
    <div className="flex flex-1 w-full h-full min-h-0 relative overflow-hidden">
      <ConversationList
        selectedId={selectedId}
        onSelect={(id) => setSelectedId(id || null)}
        selectedModelBlockId={selectedModelBlockId}
        onSelectModelBlockId={setSelectedModelBlockId}
        onOpenModelManager={() => setIsModelManagerOpen(true)}
        onOpenAddModel={() => setIsAddModelOpen(true)}
      />
      <ChatStreamView
        conversationId={selectedId}
        selectedModelBlockId={selectedModelBlockId}
        onConversationCreated={(id) => setSelectedId(id)}
        onOpenAddModel={() => setIsAddModelOpen(true)}
      />

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
