"use client";

import { useState } from "react";
import { ChatStreamView, ConversationList } from "@/features/conversations";
import { ModelBlockManagementView } from "@/features/model-blocks";

/**
 * Chat app entry page: a conversation list side panel plus the streaming chat view,
 * with model block management overlay.
 */
export default function ChatPage() {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [isModelManagerOpen, setIsModelManagerOpen] = useState(false);

  return (
    <div className="flex h-full min-h-0 relative">
      <ConversationList
        selectedId={selectedId}
        onSelect={(id) => setSelectedId(id || null)}
        onOpenModelManager={() => setIsModelManagerOpen(true)}
      />
      <ChatStreamView conversationId={selectedId} />

      <ModelBlockManagementView
        isOpen={isModelManagerOpen}
        onClose={() => setIsModelManagerOpen(false)}
      />
    </div>
  );
}
