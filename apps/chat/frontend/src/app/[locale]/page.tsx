"use client";

import { useState } from "react";
import { ChatStreamView, ConversationList } from "@/features/conversations";

/**
 * Chat app entry page: a conversation list side panel plus the streaming chat view,
 * primarily built to manually verify the SSE streaming pipeline end to end.
 */
export default function ChatPage() {
  const [selectedId, setSelectedId] = useState<string | null>(null);

  return (
    <div className="flex h-full min-h-0">
      <ConversationList
        selectedId={selectedId}
        onSelect={(id) => setSelectedId(id || null)}
      />
      <ChatStreamView conversationId={selectedId} />
    </div>
  );
}
