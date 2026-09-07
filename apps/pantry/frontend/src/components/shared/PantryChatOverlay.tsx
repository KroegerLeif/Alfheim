"use client";

import { usePantryChat } from "@/core/chatContext";
import { ChatWidget, resolveApiUrl } from "@alfheim/shared";

export function PantryChatOverlay() {
  const { isChatOpen, closeChat, chatContext, householdId } = usePantryChat();

  const chatApiUrl = resolveApiUrl('/api/v1/chat', process.env.NEXT_PUBLIC_CHAT_API_URL);

  return (
    <ChatWidget
      isOpen={isChatOpen}
      onClose={closeChat}
      context={chatContext}
      householdId={householdId}
      apiBaseUrl={chatApiUrl}
    />
  );
}
