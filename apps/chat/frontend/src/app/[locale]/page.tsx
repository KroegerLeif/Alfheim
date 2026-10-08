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
 * with model block management overlay. Narrow screens show one pane at a time: the
 * list, or the open conversation with a back button.
 */
export default function ChatPage() {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  // Model block for the next new conversation; an open conversation keeps its own.
  const [newConversationModelId, setNewConversationModelId] = useState<string>("");
  const [isModelManagerOpen, setIsModelManagerOpen] = useState(false);
  const [isAddModelOpen, setIsAddModelOpen] = useState(false);
  const createMutation = useCreateModelBlock();

  const closeAddModel = () => {
    setIsAddModelOpen(false);
    createMutation.reset();
  };

  return (
    <div className="flex flex-1 w-full h-full min-h-0 relative overflow-hidden">
      <ConversationList
        className={selectedId ? "hidden md:flex" : "flex"}
        selectedId={selectedId}
        onSelect={(id) => setSelectedId(id || null)}
        selectedModelBlockId={newConversationModelId}
        onSelectModelBlockId={setNewConversationModelId}
        onOpenModelManager={() => setIsModelManagerOpen(true)}
        onOpenAddModel={() => setIsAddModelOpen(true)}
      />
      <div className={`${selectedId ? "flex" : "hidden md:flex"} flex-1 min-w-0`}>
        <ChatStreamView
          conversationId={selectedId}
          selectedModelBlockId={newConversationModelId}
          onConversationCreated={(id) => setSelectedId(id)}
          onOpenAddModel={() => setIsAddModelOpen(true)}
          onBack={() => setSelectedId(null)}
        />
      </div>

      <ModelBlockManagementView
        isOpen={isModelManagerOpen}
        onClose={() => setIsModelManagerOpen(false)}
      />

      <ModelBlockFormModal
        isOpen={isAddModelOpen}
        onClose={closeAddModel}
        onSubmit={(payload) => {
          if (!("id" in payload)) {
            createMutation.mutate(payload, { onSuccess: closeAddModel });
          }
        }}
        isPending={createMutation.isPending}
        submitFailed={createMutation.isError}
      />
    </div>
  );
}
